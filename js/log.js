/* ============================================================
   WORKOUT LOG VIEW
   Dated history, separate from the reusable weekly Plan template.
   Lets someone log what they actually did, backfill a missed day,
   or plan ahead, and feeds the Progress page's per-exercise charts.
   ============================================================ */

function renderLog() {
  const date = UI.logDate;
  const entries = STATE.workoutLog[date] || [];
  const bw = currentWeightKg();
  const compliance = getWorkoutComplianceCheck();
  const isToday = date === todayISO();
  const dateObj = new Date(date + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  let dayKcal = 0;
  const rows = entries.map((e, i) => {
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
      meta = `${e.durationMin} min`;
    }
    return `
      <div class="exercise-row">
        <div>
          <div class="name">${escapeAttr(ex.name)}</div>
          <div class="meta">${meta} . ${ex.bodyPart || ex.category || 'Custom'}</div>
        </div>
        <div class="kcal">${Math.round(kcal)} kcal</div>
        <button class="icon-btn" onclick="removeLogExercise(${i})" title="Remove">x</button>
      </div>
    `;
  }).join('');

  const sessionFeedback = entries.length ? getSessionIntensityFeedback(dayKcal) : null;

  return `
    <div class="page-head">
      <p class="page-eyebrow">Log</p>
      <h1 class="page-title">Workout log</h1>
      <p class="page-sub">Log what you actually did on a given day. Move backward to backfill missed days, or forward to plan ahead.</p>
    </div>

    ${compliance ? renderComplianceCard(compliance) : ''}

    <div class="card">
      <div class="day-nav" style="margin-bottom:0;">
        <button class="day-nav-btn" onclick="shiftLogDate(-1)" title="Previous day">‹</button>
        <div class="day-nav-label">
          ${dateLabel}${isToday ? ' (today)' : ''}
          <span class="sub">${entries.length} exercise(s) logged, ${Math.round(dayKcal)} kcal</span>
        </div>
        <button class="day-nav-btn" onclick="shiftLogDate(1)" title="Next day">›</button>
      </div>
      <div class="field-row" style="margin-top:12px;">
        <div class="field" style="margin-bottom:0;">
          <input type="date" data-focus-id="log-date" value="${date}" oninput="setLogDate(this.value)">
        </div>
        ${!isToday ? `<button class="btn btn-sm" onclick="setLogDate('${todayISO()}')" style="flex:0;">Jump to today</button>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        Exercises this day
        <button class="btn btn-sm" onclick="openCopyIntoLog()">Copy from...</button>
      </div>

      ${UI.logCopyOpen ? renderCopyIntoLogMenu() : ''}

      ${entries.length ? `<div class="row-list">${rows}</div>` : `<div class="empty-state">Nothing logged for this day yet.</div>`}

      <hr class="div">
      <div class="grid grid-2" style="align-items:end; margin-bottom:14px;">
        <div class="stat">
          <div class="stat-label">Day total</div>
          <div class="stat-value accent">${Math.round(dayKcal)}<span class="unit">kcal</span></div>
        </div>
        ${sessionFeedback ? `
          <div class="stat">
            <div class="stat-label">Session feedback</div>
            <div style="margin-top:4px;">${tip(`<span class="badge badge-ok">${sessionFeedback.label}</span>`, sessionFeedback.label, sessionFeedback.note)}</div>
          </div>
        ` : ''}
      </div>

      ${UI.logAddOpen ? renderAddExerciseForm(null, 'log') : `
        <button class="btn btn-primary" onclick="openAddExerciseLog()">+ Add exercise</button>
      `}
    </div>
  `;
}

function renderComplianceCard(c) {
  const badgeClass = c.status === 'good' ? 'badge-ok' : c.status === 'behind' ? 'badge-warn' : 'badge-danger';
  const badgeText = c.status === 'good' ? 'On pace' : c.status === 'behind' ? 'Behind pace' : 'Way behind';
  return `
    <div class="card">
      <div class="card-title">This week vs. your plan <span class="badge ${badgeClass}">${badgeText}</span></div>
      <p class="hint" style="font-size:13px;">${c.message}</p>
    </div>
  `;
}

function renderCopyIntoLogMenu() {
  const planDays = STATE.workoutPlan.days.filter(d => d.exercises.length > 0);
  const yesterday = new Date(UI.logDate + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yIso = yesterday.toISOString().slice(0, 10);
  const hasYesterday = STATE.workoutLog[yIso] && STATE.workoutLog[yIso].length > 0;

  if (!planDays.length && !hasYesterday) {
    return `<div class="section-note">No plan days or previous logs to copy from yet.</div>`;
  }
  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:12px; margin-bottom:14px;">
      <p class="hint" style="margin-bottom:8px;">Copy exercises from:</p>
      <div class="chip-row">
        ${planDays.map(d => `<button class="chip" onclick="copyPlanDayIntoLog('${d.id}')">Plan: ${escapeAttr(d.name)}</button>`).join('')}
        ${hasYesterday ? `<button class="chip" onclick="copyLogDateIntoLog('${yIso}')">Previous day's log</button>` : ''}
        <button class="chip" onclick="closeCopyIntoLog()">Cancel</button>
      </div>
    </div>
  `;
}

// ---------- Actions ----------

function shiftLogDate(days) {
  const d = new Date(UI.logDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  UI.logDate = d.toISOString().slice(0, 10);
  UI.logAddOpen = false;
  UI.logCopyOpen = false;
  render();
}

function setLogDate(date) {
  UI.logDate = date;
  UI.logAddOpen = false;
  UI.logCopyOpen = false;
  render();
}

function ensureLogDate(date) {
  if (!STATE.workoutLog[date]) STATE.workoutLog[date] = [];
  return STATE.workoutLog[date];
}

function openAddExerciseLog() {
  UI.logAddOpen = true;
  UI.addExerciseCategory = 'Chest';
  _weightIsPerSide = false;
  render();
}
function closeAddExerciseLog() {
  UI.logAddOpen = false;
  render();
}

function submitAddExerciseLog() {
  const entry = buildExerciseEntryFromForm();
  if (!entry) return;
  ensureLogDate(UI.logDate).push(entry);
  UI.logAddOpen = false;
  persist(); render();
}
function submitAddCustomExerciseLog() {
  const entry = buildCustomExerciseEntryFromForm();
  ensureLogDate(UI.logDate).push(entry);
  UI.logAddOpen = false;
  persist(); render();
}

function removeLogExercise(index) {
  STATE.workoutLog[UI.logDate].splice(index, 1);
  persist(); render();
}

function openCopyIntoLog() {
  UI.logCopyOpen = true;
  UI.logAddOpen = false;
  render();
}
function closeCopyIntoLog() {
  UI.logCopyOpen = false;
  render();
}
function copyPlanDayIntoLog(planDayId) {
  const planDay = STATE.workoutPlan.days.find(d => d.id === planDayId);
  if (!planDay) return;
  const copied = planDay.exercises.map(e => ({ ...e, id: uid() }));
  ensureLogDate(UI.logDate).push(...copied);
  UI.logCopyOpen = false;
  persist(); render();
  toast(`Copied ${copied.length} exercise(s) from ${planDay.name}`);
}
function copyLogDateIntoLog(sourceDate) {
  const source = STATE.workoutLog[sourceDate] || [];
  const copied = source.map(e => ({ ...e, id: uid() }));
  ensureLogDate(UI.logDate).push(...copied);
  UI.logCopyOpen = false;
  persist(); render();
  toast(`Copied ${copied.length} exercise(s)`);
}
