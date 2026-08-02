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

function workoutUsesImperial() { return STATE.profile.unitSystem === 'imperial'; }
function workoutWeightUnit() { return workoutUsesImperial() ? 'lb' : 'kg'; }
function workoutWeightToDisplay(kg) { return workoutUsesImperial() ? kgToLb(kg) : kg; }
function workoutWeightFromDisplay(value) { return workoutUsesImperial() ? lbToKg(value) : value; }

function renderWorkouts() {
  const days = STATE.workoutPlan.days;
  if (!UI.workoutDayId && days.length) UI.workoutDayId = days[0].id;
  const activeDay = days.find(d => d.id === UI.workoutDayId);
  const bw = currentWeightKg();
  const summary = weeklyPlanSummary();
  const lvl = getActivityLevel();
  const stepBonus = getStepBonus();
  const weeklyAssessment = bw ? assessWeeklyBurnForGoal(summary.totalWeeklyExerciseKcal) : null;
  const movementCollapsed = STATE.uiPrefs.weeklyMovementCollapsed;

  return `
    <div class="page-head">
      <p class="page-eyebrow">Plan</p>
      <h1 class="page-title">Workout plan</h1>
      <p class="page-sub">Your reusable weekly template. Head to the <a href="#" onclick="navigate('log'); return false;">Workout Log</a> to record what you actually did on a given day.</p>
    </div>

    ${!bw ? `<div class="section-note">Set your weight on the Home page first. Calorie estimates need it.</div>` : ''}

    ${renderGoalTrainingLens()}

    ${renderWorkoutLocationManager()}

    <div class="grid grid-3" style="margin-bottom:16px;">
      <div class="card"><div class="stat"><div class="stat-label">Training days / week</div><div class="stat-value">${summary.workoutDaysPerWeek}</div></div></div>
      <div class="card">
        <div class="stat">
          <div class="stat-label">Weekly exercise burn</div>
          <div class="stat-value accent">
            ${weeklyAssessment
              ? tip(`${Math.round(summary.totalWeeklyExerciseKcal)}<span class="unit">kcal</span>`, `${weeklyAssessment.label} for the week`, `${weeklyAssessment.note}${weeklyAssessment.goalNote}`)
              : '—'}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="stat-label">Starting step estimate ${tip('ⓘ', 'This is just a starting point', 'Once you check in your steps a few times on the Workout Log page, your real rolling average takes over completely. This number only matters before that history builds up.')}</div>
        <input aria-label="Starting daily step estimate" type="number" data-focus-id="steps-per-day" min="0" max="200000" step="500" value="${STATE.workoutPlan.stepsPerDay}" onchange="updateSteps(this.value)" onkeydown="if(event.key==='Enter') this.blur()" style="margin-top:6px;">
      </div>
    </div>

    ${summary.workoutDaysPerWeek > 0 ? `
      <div class="card${movementCollapsed ? ' panel-card-collapsed' : ''}">
        <div class="card-title"><span>Weekly movement check</span>${movementCollapsed ? `<span class="panel-inline-summary">${summary.strengthDaysPerWeek} strength · ${Math.round(summary.aerobicMinutes)} aerobic min</span>` : ''}<button class="panel-collapse-btn" onclick="toggleRememberedPanel('weeklyMovementCollapsed')" aria-expanded="${!movementCollapsed}" aria-label="${movementCollapsed ? 'Expand' : 'Minimize'} weekly movement check">${movementCollapsed ? '+' : '−'}</button></div>
        ${movementCollapsed ? '' : `<p class="hint">Plan snapshot: ${summary.strengthDaysPerWeek} strength day(s) and about ${Math.round(summary.aerobicMinutes)} aerobic/sport minute(s). For general adult health, <a href="https://odphp.health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines/current-guidelines/top-10-things-know" target="_blank" rel="noopener noreferrer">current U.S. guidance</a> recommends working gradually toward 150-300 minutes of moderate aerobic activity (or the vigorous equivalent) and muscle strengthening on at least 2 days each week. Your starting point and recovery capacity matter; doing some activity consistently is already valuable.</p>`}
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

    ${notice('cardio-step-overlap-general', `Logging running or walking as a workout below can overlap with the step count above. If a walk/run is already part of your normal daily steps, log it in one place only.`, { maxLevel: 3, defaultOpenThrough: 1, brief: 'Avoid double counting: if a walk or run is already included in your step total, do not also log the same activity as extra exercise.' })}

    ${notice('strength-consistency-2026', `<strong>Keep strength training simple enough to repeat:</strong> current evidence supports many combinations of loads, sets, and equipment. Consistency is the biggest step up from doing none; multiple sets can help muscle growth and heavier loads tend to favor maximal strength, but training to failure and advanced programming are not required for most healthy adults.`, { maxLevel: 2, defaultOpenThrough: 1, brief: '<strong>Repeatable beats elaborate:</strong> multiple sets can support muscle growth and heavier loads favor maximal strength, but failure training and advanced programming are optional.' })}

    ${notice('weight-vs-calories-tip', `
      <strong>Heads up on what "burning more calories" actually depends on:</strong> lifting heavier doesn't directly burn a lot
      more calories, the extra effort mostly builds strength, not calorie burn. Our estimate scales mainly with how long you're
      actively working (time under load), not how much weight is on the bar. It's also worth knowing that most of your daily
      calorie burn happens outside the gym, workouts are usually a smaller slice of the day than people assume (see the energy
      breakdown on Home). And muscle itself is built during recovery, not during the set, your body repairs and grows tissue in
      the hours and days after training, which is part of why rest and protein matter as much as the workout itself.
    `, { maxLevel: 0, defaultOpenThrough: 0 })}

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

function renderGoalTrainingLens() {
  const guidance = getGoalGuidance();
  const expert = (STATE.uiPrefs.knowledgeLevel || 0) >= 4;
  return `<div class="card goal-training-lens">
    <div class="card-title">Training lens: ${escapeAttr(guidance.focus.label)}</div>
    <p class="hint">${escapeAttr(guidance.training)}${expert ? '' : ` ${escapeAttr(guidance.nuance)}`}</p>
  </div>`;
}

function renderDayCard(day, bw) {
  let dayKcal = 0;
  const rows = day.exercises.map(e => renderExerciseRow(e, bw, { scope: 'workout', dayId: day.id })).join('');
  day.exercises.forEach(e => { dayKcal += calcExerciseCalories(e, bw); });

  const sessionFeedback = dayKcal > 0 ? getSessionIntensityFeedback(dayKcal) : null;

  return `
    <div class="card ${STATE.onboarding.active && STATE.onboarding.step === 3 ? 'onboarding-focus' : ''}">
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

      ${renderWorkoutLocationSelect(day.locationId || '', `setWorkoutPlanDayLocation('${day.id}', this.value)`, 'Planned location')}

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
              ${tip(`<span class="badge badge-ok">${sessionFeedback.label}</span>`, sessionFeedback.label, `${sessionFeedback.note} Treat calorie burn as a rough estimate, not a score to maximize.`)}
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
  const calculationEntry = target.scope === 'log' ? completedExerciseEntry(e) : e;
  const kcal = calculationEntry ? calcExerciseCalories(calculationEntry, bw) : 0;
  const kcalBody = calculationEntry
    ? `${target.scope === 'log' ? 'Only completed work is included. ' : ''}${explainExerciseCalc(calculationEntry, ex, bw)}`
    : 'Check off completed work to include it in workout calories and progress.';
  const kcalTip = tip(`${Math.round(kcal)} kcal`, 'How this is calculated', kcalBody);
  const editAttr = target.scope === 'workout'
    ? `openEditExercise('${target.dayId}', '${e.id}')`
    : `openEditExerciseLog('${e.id}')`;
  const removeAttr = target.scope === 'workout'
    ? `removeExercise('${target.dayId}', '${e.id}')`
    : `removeLogExercise('${e.id}')`;

  // Ramping/per-set weights get their own block with one line per set, instead
  // of being crammed into a single hard-to-read row.
  if (e.perSetWeights && e.perSetWeights.length) {
    const allDone = e.perSetWeights.every(s => s.completed);
    const setRows = e.perSetWeights.map((s, i) => {
      const displayLoad = Math.round(workoutWeightToDisplay(s.weightIsPerSide ? s.weightKg * 2 : s.weightKg) * 10) / 10;
      const checkboxAttr = target.scope === 'log' ? `onchange="toggleLogSetDone('${e.id}', ${i})"` : 'disabled';
      return `
        <div class="set-row ${s.completed ? 'set-done' : ''}">
          <span class="set-label">SET ${i + 1}</span>
          ${showCheckbox ? `<input type="checkbox" ${s.completed ? 'checked' : ''} ${checkboxAttr}>` : ''}
          <span class="set-detail">${s.reps} reps${displayLoad ? ` @ ${displayLoad} ${workoutWeightUnit()}${s.weightIsPerSide ? ' per side' : ''}` : ''}</span>
          ${target.scope === 'log' ? `<button class="icon-btn" onclick="quickStartRestTimer(${inlineArg(`Rest, ${ex.name} set ${i + 1}`)})" title="Start rest timer" aria-label="Start rest timer after ${escapeAttr(ex.name)} set ${i + 1}">\u23F1</button>` : ''}
        </div>
      `;
    }).join('');
    return `
      <div class="exercise-block">
        <div class="exercise-block-header">
          <div class="name" style="${allDone ? 'opacity:0.55;' : ''}">${escapeAttr(ex.name)}${allDone ? ' \u2713' : ''}</div>
          <div class="kcal">${kcalTip}</div>
          ${target.scope === 'log' ? `<button class="icon-btn" onclick="quickStartRestTimer('Rest before next exercise')" title="Start rest timer">\u23F1</button>` : ''}
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
    const displayLoad = Math.round(workoutWeightToDisplay(load) * 10) / 10;
    meta = `${e.sets}x${e.reps} @ ${displayLoad ? displayLoad + ' ' + workoutWeightUnit() + ' total' : 'bodyweight'}${e.weightIsPerSide ? ' (per side x2)' : ''}`;
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
      ${target.scope === 'log' && ex.category === 'Strength' ? `<button class="icon-btn" onclick="quickStartRestTimer(${inlineArg(`Rest, ${ex.name}`)})" title="Start rest timer" aria-label="Start rest timer after ${escapeAttr(ex.name)}">\u23F1</button>` : ''}
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
        ${otherDays.map(d => `<button class="chip" onclick="copyDayInto('${d.id}', '${day.id}')">${escapeAttr(d.name)}${d.locationId ? ` · ${escapeAttr(workoutLocationName(d.locationId))}` : ''}</button>`).join('')}
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
          ${recents.map(r => `<button class="chip" onclick="quickAddRecent(${inlineArg(r.key)}, ${inlineArg(target.scope)}, ${inlineArg(target.dayId || '')})">${escapeAttr(r.label)}</button>`).join('')}
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
    const defaultWeight = workoutUsesImperial() ? 45 : 20;
    const displayWeight = existingEntry && !perSet ? Math.round(workoutWeightToDisplay(existingEntry.weightKg || 0) * 10) / 10 : defaultWeight;
    _weightIsPerSide = existingEntry
      ? !!(perSet ? existingEntry.perSetWeights[0]?.weightIsPerSide : existingEntry.weightIsPerSide)
      : false;
    return `
      <div class="field-row">
        <div class="field"><label>Sets</label><input type="number" id="f-sets" data-focus-id="f-sets" min="1" value="${sets}"></div>
        <div class="field"><label>Reps (if same across sets)</label><input type="number" id="f-reps" data-focus-id="f-reps" min="1" value="${reps}"></div>
        <div class="field"><label for="f-weight">Weight (${workoutWeightUnit()}, if same across sets)</label><input type="number" id="f-weight" data-focus-id="f-weight" min="0" step="0.1" value="${displayWeight}"></div>
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
      <p class="hint">Defaults to the same reps/weight for every set. Use the button above for ramping sets (for example, ${workoutUsesImperial() ? '25, 35, then 45 lb' : '10, 15, then 20 kg'}).</p>
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
          <div class="field" style="margin-bottom:0;"><label>Set ${i + 1} weight (${workoutWeightUnit()})</label><input type="number" class="per-set-weight" min="0" step="0.1" value="${Math.round(workoutWeightToDisplay(s.weightKg || 0) * 10) / 10}"></div>
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
  const defaultWeight = workoutUsesImperial() ? 45 : 20;
  const displayWeight = Number(document.getElementById('f-weight')?.value) || defaultWeight;
  const rows = Array.from({ length: sets }, () => ({ reps, weightKg: workoutWeightFromDisplay(displayWeight) }));
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
  STATE.workoutPlan.stepsPerDay = Math.max(0, Math.min(200000, Number(val) || 0));
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
  const loggedScope = editing ? editing.scope : scope;
  const finalEntry = loggedScope === 'log' ? expandExerciseEntryForLog(entry, false) : entry;
  if (editing) {
    finalEntry.id = editing.entryId; // preserve identity so progress history stays continuous
    finalEntry.completed = findExerciseEntry(editing)?.completed || false;
    if (editing.scope === 'workout') {
      const day = STATE.workoutPlan.days.find(d => d.id === editing.dayId);
      const idx = day.exercises.findIndex(e => e.id === editing.entryId);
      if (idx >= 0) day.exercises[idx] = finalEntry;
    } else {
      const list = STATE.workoutLog[editing.date];
      const idx = list.findIndex(e => e.id === editing.entryId);
      if (idx >= 0) list[idx] = finalEntry;
    }
  } else if (scope === 'workout') {
    STATE.workoutPlan.days.find(d => d.id === dayId).exercises.push(finalEntry);
  } else {
    ensureLogDate(UI.logDate).push(finalEntry);
  }

  const ex = EXERCISE_LIBRARY.find(x => x.id === finalEntry.exerciseId);
  const label = ex ? ex.name : (finalEntry.custom ? finalEntry.custom.name : 'Exercise');
  const key = finalEntry.exerciseId || ('custom:' + (finalEntry.custom ? finalEntry.custom.name : label));
  recordRecentExercise(key, label, finalEntry);

  if (loggedScope === 'log' && typeof markPetInteraction === 'function') markPetInteraction(3);

  UI.addExerciseOpenFor = null;
  UI.logAddOpen = false;
  UI.editingExercise = null;
  persist(); render();
}

// Shared field-reading helpers.
function buildExerciseEntryFromForm() {
  const selectEl = document.getElementById('ex-select');
  const ex = EXERCISE_LIBRARY.find(x => x.id === selectEl.value);
  if (!ex) { toast('Choose a valid exercise.'); return null; }
  const entry = { id: uid(), exerciseId: ex.id };
  if (ex.inputMode === 'duration' || ex.inputMode === 'distance') {
    entry.durationMin = Number(document.getElementById('f-duration').value) || 0;
  } else if (ex.inputMode === 'setsRepsWeight') {
    const perSetContainer = document.getElementById('per-set-container');
    const perSetRows = perSetContainer ? perSetContainer.querySelectorAll('.field-row') : [];
    if (perSetRows.length) {
      const previousSets = findExerciseEntry(UI.editingExercise)?.perSetWeights || [];
      entry.perSetWeights = Array.from(perSetRows).map((row, index) => ({
        reps: Number(row.querySelector('.per-set-reps').value) || 0,
        weightKg: workoutWeightFromDisplay(Number(row.querySelector('.per-set-weight').value) || 0),
        weightIsPerSide: _weightIsPerSide,
        completed: !!previousSets[index]?.completed,
      }));
      entry.sets = entry.perSetWeights.length;
    } else {
      entry.sets = Number(document.getElementById('f-sets').value) || 0;
      entry.reps = Number(document.getElementById('f-reps').value) || 0;
      entry.weightKg = workoutWeightFromDisplay(Number(document.getElementById('f-weight').value) || 0);
      entry.weightIsPerSide = _weightIsPerSide;
    }
  } else {
    entry.sets = Number(document.getElementById('f-sets').value) || 0;
    entry.reps = Number(document.getElementById('f-reps').value) || 0;
  }
  const durationInvalid = entry.durationMin != null && (entry.durationMin <= 0 || entry.durationMin > 1440);
  const setInvalid = entry.perSetWeights
    ? (!entry.perSetWeights.length || entry.perSetWeights.some(s => s.reps <= 0 || s.reps > 1000 || s.weightKg > 1000))
    : (entry.sets != null && (entry.sets <= 0 || entry.sets > 100)) || (entry.reps != null && (entry.reps <= 0 || entry.reps > 1000)) || (entry.weightKg != null && entry.weightKg > 1000);
  if (durationInvalid || setInvalid) {
    toast('Check the exercise values: duration, sets, and reps must be positive and within a practical range.');
    return null;
  }
  return entry;
}
function buildCustomExerciseEntryFromForm() {
  const name = document.getElementById('c-name').value.trim() || 'Custom exercise';
  const met = Number(document.getElementById('c-met').value) || 5;
  const duration = Number(document.getElementById('c-duration').value) || 30;
  if (met < 1 || met > 25 || duration < 1 || duration > 1440) {
    toast('Use a MET value from 1-25 and a duration from 1-1,440 minutes.');
    return null;
  }
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
  const entry = cloneExerciseEntry(recent.snapshot, { id: uid(), completed: false });
  if (entry.perSetWeights) entry.perSetWeights.forEach(s => { s.completed = false; });
  if (scope === 'workout') {
    STATE.workoutPlan.days.find(d => d.id === dayId).exercises.push(entry);
  } else {
    ensureLogDate(UI.logDate).push(expandExerciseEntryForLog(entry, true));
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
  const copied = source.exercises.map(e => cloneExerciseEntry(e, { id: uid() }));
  target.exercises = target.exercises.concat(copied);
  UI.copyDayOpenFor = null;
  persist(); render();
  toast(`Copied ${copied.length} exercise(s) from ${source.name}`);
}
