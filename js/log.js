/* ============================================================
   WORKOUT LOG VIEW
   Dated history, separate from the reusable weekly Plan template.
   Copy a Plan day in (or a previous day's log), check items off as
   you complete them, and edit anything after the fact, that's what
   makes the Progress page's charts meaningful instead of a flat line.
   ============================================================ */

function renderLog() {
  const date = UI.logDate;
  const entries = STATE.workoutLog[date] || [];
  const bw = currentWeightKg();
  const compliance = getWorkoutComplianceCheck();
  const isToday = date === todayISO();
  const dateObj = new Date(date + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  const performedEntries = entries.map(completedExerciseEntry).filter(Boolean);
  let dayKcal = 0;
  performedEntries.forEach(e => { dayKcal += calcExerciseCalories(e, bw); });
  const completedCount = entries.filter(isExerciseFullyCompleted).length;
  const rows = entries.map(e => renderExerciseRow(e, bw, { scope: 'log', date }, true)).join('');

  const sessionFeedback = dayKcal > 0 ? getSessionIntensityFeedback(dayKcal) : null;
  const restCollapsed = STATE.uiPrefs.restTimerPanelCollapsed;
  const expert = (STATE.uiPrefs.knowledgeLevel || 0) >= 4;

  return `
    <div class="page-head">
      <p class="page-eyebrow">Log</p>
      <h1 class="page-title">Workout log</h1>
      <p class="page-sub">What you actually did on a given day. Copy a plan day in, check items off as you go, and edit anything that doesn't match reality.</p>
    </div>

    <div class="card">
      <div class="date-nav-row" style="margin-bottom:0;">
        <button class="date-nav-btn" onclick="shiftLogDate(-1)" title="Previous day">‹</button>
        <div class="date-nav-bar date-nav-label">
          ${dateLabel}${isToday ? ' (today)' : ''}
          <span class="sub">${entries.length} exercise(s)${entries.length ? `, ${completedCount}/${entries.length} fully completed` : ''}, ${Math.round(dayKcal)} completed-work kcal</span>
        </div>
        <button class="date-nav-btn" onclick="shiftLogDate(1)" title="Next day">›</button>
      </div>
      <div class="field-row" style="margin-top:12px;">
        <div class="field" style="margin-bottom:0;">
          <input type="date" data-focus-id="log-date" value="${date}" onchange="setLogDate(this.value)">
        </div>
        ${!isToday ? `<button class="btn btn-sm" onclick="setLogDate('${todayISO()}')" style="flex: 0 0 auto; white-space: nowrap;">Jump to today</button>` : ''}
      </div>
    </div>

    ${compliance ? renderComplianceCard(compliance) : ''}

    ${renderStepCheckinCard(date)}

    <div class="card">
      <div class="card-title">Rest timer <button class="panel-collapse-btn" onclick="toggleRememberedPanel('restTimerPanelCollapsed')" aria-expanded="${!restCollapsed}" aria-label="${restCollapsed ? 'Expand' : 'Minimize'} rest timer settings">${restCollapsed ? '+' : '−'}</button></div>
      ${restCollapsed ? `<p class="panel-collapsed-summary">Default: ${STATE.workoutPlan.restTimerSeconds} seconds</p>` : `
      <div class="field-row" style="align-items:end;">
        <div class="field" style="margin-bottom:0;">
          <label>Default duration (seconds)</label>
          <input type="number" data-focus-id="rest-timer-default" min="10" max="900" step="15" value="${STATE.workoutPlan.restTimerSeconds}" onchange="updateRestTimerDefault(this.value)" onkeydown="if(event.key==='Enter') this.blur()">
        </div>
        <button class="btn btn-primary" onclick="quickStartRestTimer('Rest')" style="flex: 0 0 auto;">Start rest timer</button>
      </div>
      ${expert ? '' : `<p class="hint">Also available next to any exercise or set below, once you're actually logging (not on the Plan template).</p>`}
      `}
    </div>

    <div class="card">
      <div class="card-title">
        Exercises this day
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm" onclick="openCopyIntoLog('add')">Copy from...</button>
          <button class="btn btn-sm" onclick="openCopyIntoLog('replace')">Replace with...</button>
        </div>
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

      ${UI.logAddOpen ? renderAddExerciseForm({ scope: 'log' }) : `
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
      <p class="hint" style="font-size:13px;">${c.message} Only completed exercises or sets count.</p>
    </div>
  `;
}

function renderCopyIntoLogMenu() {
  const planDays = STATE.workoutPlan.days.filter(d => d.exercises.length > 0);
  const yesterday = new Date(UI.logDate + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yIso = dateToLocalISO(yesterday);
  const hasYesterday = STATE.workoutLog[yIso] && STATE.workoutLog[yIso].length > 0;
  const isReplace = UI.logCopyMode === 'replace';

  if (!planDays.length && !hasYesterday) {
    return `<div class="section-note">No plan days or previous logs to copy from yet.</div>`;
  }
  const planFn = isReplace ? 'replacePlanDayIntoLog' : 'copyPlanDayIntoLog';
  const logFn = isReplace ? 'replaceLogDateIntoLog' : 'copyLogDateIntoLog';
  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:12px; margin-bottom:14px;">
      <p class="hint" style="margin-bottom:8px;">${isReplace ? 'Replace everything logged today with:' : 'Copy exercises from:'}${isReplace ? ' <strong style="color:var(--danger);">This clears what\'s currently logged for this day.</strong>' : ''}</p>
      <div class="chip-row">
        ${planDays.map(d => `<button class="chip" onclick="${planFn}('${d.id}')">Plan: ${escapeAttr(d.name)}</button>`).join('')}
        ${hasYesterday ? `<button class="chip" onclick="${logFn}('${yIso}')">Previous day's log</button>` : ''}
        <button class="chip" onclick="closeCopyIntoLog()">Cancel</button>
      </div>
    </div>
  `;
}

// ---------- Actions ----------

function updateRestTimerDefault(val) {
  STATE.workoutPlan.restTimerSeconds = Math.max(10, Math.min(900, Number(val) || 90));
  persist(); render();
}

function shiftLogDate(days) {
  const d = new Date(UI.logDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  UI.logDate = dateToLocalISO(d);
  UI.logAddOpen = false;
  UI.logCopyOpen = false;
  UI.editingExercise = null;
  render();
}

function setLogDate(date) {
  if (!isReasonableDateString(date)) { toast("That doesn't look like a valid date, try again"); render(); return; }
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
  UI.editingExercise = null;
  UI.addExerciseCategory = 'Chest';
  _weightIsPerSide = false;
  render();
}

function openEditExerciseLog(entryId) {
  const entry = (STATE.workoutLog[UI.logDate] || []).find(e => e.id === entryId);
  if (!entry) return;
  const ex = EXERCISE_LIBRARY.find(x => x.id === entry.exerciseId);
  UI.editingExercise = { scope: 'log', date: UI.logDate, entryId };
  UI.logAddOpen = true;
  UI.addExerciseCategory = ex ? ex.bodyPart : 'Custom';
  render();
}

function removeLogExercise(entryId) {
  STATE.workoutLog[UI.logDate] = (STATE.workoutLog[UI.logDate] || []).filter(e => e.id !== entryId);
  persist(); render();
}

function toggleLogExerciseDone(entryId) {
  const entry = (STATE.workoutLog[UI.logDate] || []).find(e => e.id === entryId);
  if (!entry) return;
  entry.completed = !entry.completed;
  persist(); render();
}

function toggleLogSetDone(entryId, setIndex) {
  const entry = (STATE.workoutLog[UI.logDate] || []).find(e => e.id === entryId);
  if (!entry || !entry.perSetWeights || !entry.perSetWeights[setIndex]) return;
  entry.perSetWeights[setIndex].completed = !entry.perSetWeights[setIndex].completed;
  const justCompleted = entry.perSetWeights[setIndex].completed;
  persist();
  if (justCompleted) {
    const ex = EXERCISE_LIBRARY.find(x => x.id === entry.exerciseId) || entry.custom;
    quickStartRestTimer(`Rest, ${ex?.name || 'set'} set ${setIndex + 1}`);
  } else {
    render();
  }
}

function copyExerciseForLog(entry) {
  const copy = expandExerciseEntryForLog(cloneExerciseEntry(entry, { id: uid(), completed: false }), true);
  return copy;
}

function openCopyIntoLog(mode) {
  UI.logCopyOpen = true;
  UI.logCopyMode = mode || 'add';
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
  const copied = planDay.exercises.map(copyExerciseForLog);
  ensureLogDate(UI.logDate).push(...copied);
  UI.logCopyOpen = false;
  persist(); render();
  toast(`Copied ${copied.length} exercise(s) from ${planDay.name}. Check them off as you complete them, or edit if actual weights differ.`);
}
function copyLogDateIntoLog(sourceDate) {
  const source = STATE.workoutLog[sourceDate] || [];
  const copied = source.map(copyExerciseForLog);
  ensureLogDate(UI.logDate).push(...copied);
  UI.logCopyOpen = false;
  persist(); render();
  toast(`Copied ${copied.length} exercise(s)`);
}
function replacePlanDayIntoLog(planDayId) {
  const existing = STATE.workoutLog[UI.logDate] || [];
  if (existing.length && !confirm(`This clears the ${existing.length} exercise(s) already logged today and replaces them. This can't be undone. Continue?`)) return;
  const planDay = STATE.workoutPlan.days.find(d => d.id === planDayId);
  if (!planDay) return;
  const copied = planDay.exercises.map(copyExerciseForLog);
  STATE.workoutLog[UI.logDate] = copied;
  UI.logCopyOpen = false;
  persist(); render();
  toast(`Replaced today's log with ${planDay.name}`);
}
function replaceLogDateIntoLog(sourceDate) {
  const existing = STATE.workoutLog[UI.logDate] || [];
  if (existing.length && !confirm(`This clears the ${existing.length} exercise(s) already logged today and replaces them. This can't be undone. Continue?`)) return;
  const source = STATE.workoutLog[sourceDate] || [];
  const copied = source.map(copyExerciseForLog);
  STATE.workoutLog[UI.logDate] = copied;
  UI.logCopyOpen = false;
  persist(); render();
  toast(`Replaced today's log`);
}
