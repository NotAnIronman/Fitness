/* ============================================================
   HABITS
   A deliberately small, local-first habit loop: choose a cue and
   schedule, tap once to record it, and review progress without
   punishing missed days. Archived habits keep their history.
   ============================================================ */

const HABIT_ICONS = [
  ['2705','Complete'], ['1F4AA','Strength'], ['1F6B6','Walk'], ['1F957','Nutrition'], ['1F4A7','Water'],
  ['1F9D8','Mindfulness'], ['1F6CC','Sleep'], ['1F4DA','Read'], ['2600','Morning'], ['1F319','Evening'],
  ['1F45F','Run'], ['1F6B2','Cycle'], ['1F3CA','Swim'], ['1F34E','Fruit'], ['1F966','Vegetables'],
  ['1F373','Cook'], ['1F9F9','Tidy'], ['1F9B7','Dental care'], ['1F48A','Medication'], ['1F4DD','Journal'],
  ['1F4F5','Phone break'], ['1F4BC','Work'], ['1F3AF','Focus'], ['1F3B8','Music'], ['1F331','Growth'],
  ['1F9E0','Learn'], ['1F91D','Connect'], ['1F415','Pet care'], ['1F3E0','Home'], ['1F4B0','Money'],
].map(([key, label]) => ({ key, label }));
const HABIT_DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HABIT_TEMPLATES = {
  walk: { name: 'Take a 10-minute walk', icon: '1F6B6', cue: 'After a meal', difficulty: 'easy', target: 1, days: [0,1,2,3,4,5,6] },
  prep: { name: 'Prepare tomorrow\'s workout', icon: '1F4AA', cue: 'Before bed', difficulty: 'easy', target: 1, days: [0,1,2,3,4,5,6] },
  lunch: { name: 'Pack tomorrow\'s lunch', icon: '1F957', cue: 'After dinner', difficulty: 'medium', target: 1, days: [0,1,2,3,4] },
  stretch: { name: 'Stretch for 5 minutes', icon: '1F9D8', cue: 'After training', difficulty: 'easy', target: 1, days: [0,1,2,3,4,5,6] },
  bedtime: { name: 'Start bedtime routine', icon: '1F319', cue: 'At my wind-down time', difficulty: 'medium', target: 1, days: [0,1,2,3,4,5,6] },
  water: { name: 'Drink a glass of water', icon: '1F4A7', cue: 'When I enter the kitchen', difficulty: 'easy', target: 3, days: [0,1,2,3,4,5,6] },
  read: { name: 'Read for 10 minutes', icon: '1F4DA', cue: 'After putting my phone down', difficulty: 'easy', target: 1, days: [0,1,2,3,4,5,6] },
  journal: { name: 'Write one sentence', icon: '1F4DD', cue: 'Before I go to sleep', difficulty: 'easy', target: 1, days: [0,1,2,3,4,5,6] },
};

function renderHabitIcon(key, className) {
  const icon = HABIT_ICONS.find(item => item.key === key) || HABIT_ICONS[0];
  return openMojiIcon(icon.key, icon.label, className || 'habit-openmoji');
}

function habitDateObject(iso) {
  return new Date(`${iso}T12:00:00`);
}

function shiftISODate(iso, amount) {
  const date = habitDateObject(iso);
  date.setDate(date.getDate() + amount);
  return dateToLocalISO(date);
}

function habitIsActiveOnDate(habit, date) {
  return (!habit.createdDate || habit.createdDate <= date) && (!habit.archivedAt || date < habit.archivedAt);
}

function habitIsScheduled(habit, date) {
  return habitIsActiveOnDate(habit, date) && (habit.days || []).includes(habitDateObject(date).getDay());
}

function habitCount(habitId, date) {
  return Math.max(0, Number(STATE.habits.log?.[date]?.[habitId]) || 0);
}

function habitIsDone(habit, date) {
  return habitCount(habit.id, date) >= Math.max(1, Number(habit.target) || 1);
}

function habitsScheduledForDate(date) {
  return STATE.habits.items.filter(habit => habitIsScheduled(habit, date));
}

function changeHabitCount(habitId, delta, date) {
  const habit = STATE.habits.items.find(item => item.id === habitId);
  const targetDate = date || UI.habitDate || todayISO();
  if (!habit || !habitIsScheduled(habit, targetDate) || targetDate > todayISO()) return;
  const current = habitCount(habitId, targetDate);
  let next;
  if (habit.target === 1 && delta > 0) next = current >= 1 ? 0 : 1;
  else next = Math.max(0, Math.min(habit.target, current + delta));
  if (!STATE.habits.log[targetDate]) STATE.habits.log[targetDate] = {};
  if (next) STATE.habits.log[targetDate][habitId] = next;
  else delete STATE.habits.log[targetDate][habitId];
  if (!Object.keys(STATE.habits.log[targetDate]).length) delete STATE.habits.log[targetDate];
  persist();
  if (next > current && typeof markPetInteraction === 'function') markPetInteraction(2);
  render();
}

// A scheduled day is the unit of a streak. Rest/non-scheduled days are ignored,
// and an unfinished habit today does not erase yesterday's streak while there
// is still time to do it.
function habitCurrentStreak(habit, throughDate) {
  const end = throughDate || todayISO();
  let cursor = end;
  let streak = 0;
  let firstScheduled = true;
  for (let i = 0; i < 3660; i++) {
    if (habit.createdDate && cursor < habit.createdDate) break;
    if (habitIsScheduled(habit, cursor)) {
      if (firstScheduled && cursor === todayISO() && !habitIsDone(habit, cursor)) {
        firstScheduled = false;
      } else if (habitIsDone(habit, cursor)) {
        streak++;
        firstScheduled = false;
      } else {
        break;
      }
    }
    cursor = shiftISODate(cursor, -1);
  }
  return streak;
}

function habitBestStreak(habit) {
  const start = habit.createdDate || todayISO();
  const end = habit.archivedAt ? shiftISODate(habit.archivedAt, -1) : todayISO();
  let cursor = start, run = 0, best = 0;
  for (let i = 0; cursor <= end && i < 3660; i++) {
    if (habitIsScheduled(habit, cursor)) {
      if (habitIsDone(habit, cursor)) { run++; best = Math.max(best, run); }
      else run = 0;
    }
    cursor = shiftISODate(cursor, 1);
  }
  return best;
}

function getHabitStats() {
  const items = STATE.habits?.items || [];
  const completionDates = new Set();
  let totalCompletions = 0;
  let bestStreak = 0;
  items.forEach(habit => {
    bestStreak = Math.max(bestStreak, habitBestStreak(habit));
    Object.entries(STATE.habits.log || {}).forEach(([date, values]) => {
      if ((Number(values?.[habit.id]) || 0) >= habit.target) {
        totalCompletions++;
        completionDates.add(date);
      }
    });
  });
  return { totalCompletions, completionDays: completionDates.size, bestStreak };
}

function habitDaySummary(date) {
  const scheduled = habitsScheduledForDate(date);
  const completed = scheduled.filter(habit => habitIsDone(habit, date));
  return { scheduled, completed, allDone: scheduled.length > 0 && completed.length === scheduled.length };
}

function renderHabitTodayCard(date, compact) {
  const targetDate = date || todayISO();
  const summary = habitDaySummary(targetDate);
  const isToday = targetDate === todayISO();
  const percent = summary.scheduled.length ? Math.round(summary.completed.length / summary.scheduled.length * 100) : 0;
  return `<div class="card habit-today-card ${summary.allDone ? 'habit-day-complete' : ''}">
    <div class="card-title"><span>${isToday ? 'Today\'s rhythm' : 'Daily rhythm'}</span><span class="habit-summary-count">${summary.completed.length} of ${summary.scheduled.length}</span></div>
    ${summary.scheduled.length ? `<div class="habit-progress" role="progressbar" aria-label="Habit progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>` : ''}
    ${summary.scheduled.length ? `<div class="habit-list">${summary.scheduled.map(habit => renderHabitRow(habit, targetDate)).join('')}</div>
      <p class="hint habit-kind-copy">${summary.allDone ? 'All done. A small repeat is still a real win.' : `${summary.scheduled.length - summary.completed.length} left. One tap is enough to record the work.`}</p>`
      : `<div class="habit-empty"><strong>${STATE.habits.items.some(item => !item.archivedAt) ? 'Nothing scheduled today.' : 'Make consistency easier.'}</strong><span>${STATE.habits.items.some(item => !item.archivedAt) ? 'This is a planned lighter day—your streaks are safe.' : 'Add one tiny action tied to a time or routine you already have.'}</span></div>`}
    <button class="btn btn-sm tile-link" onclick="navigate('habits')">${STATE.habits.items.some(item => !item.archivedAt) ? 'Open habit tracker' : 'Add your first habit'}</button>
  </div>`;
}

function renderHabitRow(habit, date) {
  const count = habitCount(habit.id, date);
  const done = count >= habit.target;
  const future = date > todayISO();
  const actionLabel = done ? `Mark ${habit.name} incomplete` : `Complete ${habit.name}`;
  return `<div class="habit-row ${done ? 'done' : ''}">
    <span class="habit-row-icon">${renderHabitIcon(habit.icon)}</span>
    <div class="habit-row-copy"><strong>${escapeAttr(habit.name)}</strong>${habit.cue ? `<span>${escapeAttr(habit.cue)}</span>` : ''}</div>
    ${habit.target > 1 ? `<div class="habit-counter"><button onclick="changeHabitCount('${habit.id}',-1,'${date}')" aria-label="Subtract one from ${escapeAttr(habit.name)}" ${future || count <= 0 ? 'disabled' : ''}>−</button><b>${count}/${habit.target}</b><button onclick="changeHabitCount('${habit.id}',1,'${date}')" aria-label="Add one to ${escapeAttr(habit.name)}" ${future || count >= habit.target ? 'disabled' : ''}>+</button></div>` : `<button class="habit-check" onclick="changeHabitCount('${habit.id}',1,'${date}')" aria-label="${escapeAttr(actionLabel)}" aria-pressed="${done}" ${future ? 'disabled' : ''}>${done ? appIcon('check', '') : '<span>Done</span>'}</button>`}
    ${habit.target === 1 ? `<span class="habit-streak" title="Scheduled-day streak">${habitCurrentStreak(habit)}${habitCurrentStreak(habit) === 1 ? ' day' : ' days'}</span>` : ''}
  </div>`;
}

function renderHabits() {
  const date = UI.habitDate || todayISO();
  const active = STATE.habits.items.filter(habit => !habit.archivedAt);
  const archived = STATE.habits.items.filter(habit => habit.archivedAt);
  return `<div class="page-head">
      <p class="page-eyebrow">Consistency, not perfection</p><h1 class="page-title">Habits</h1>
      <p class="page-sub">Attach small actions to familiar cues, then record them in one tap. Missed days are information—not a verdict.</p>
    </div>
    <div class="habit-date-head">
      <button class="date-nav-btn" onclick="shiftHabitDate(-1)" aria-label="Previous day">‹</button>
      <div><strong>${habitDateObject(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</strong><span>${date === todayISO() ? 'Today' : date}</span></div>
      <button class="date-nav-btn" onclick="shiftHabitDate(1)" aria-label="Next day" ${date >= todayISO() ? 'disabled' : ''}>›</button>
    </div>
    <div class="habit-primary-actions"><button class="btn btn-primary" onclick="openHabitEditor()">Add habit</button><span>Start small enough that showing up feels realistic.</span></div>
    ${UI.habitEditorOpen ? `<div class="card habit-editor-card">${renderHabitEditor()}</div>` : ''}
    ${renderHabitTodayCard(date, false)}
    ${renderHabitWeek()}
    <div class="card habit-builder-card">
      <div class="card-title"><span>Manage habits</span><span class="panel-inline-summary">${active.length} active</span></div>
      ${active.length ? `<div class="habit-manage-list">${active.map(renderHabitManageRow).join('')}</div>` : renderHabitStarterState()}
      ${archived.length ? `<details class="habit-archive"><summary>Archived (${archived.length})</summary>${archived.map(habit => `<div class="habit-manage-row"><span class="habit-manage-icon">${renderHabitIcon(habit.icon)}</span><div><strong>${escapeAttr(habit.name)}</strong><small>History preserved</small></div><button class="btn btn-sm" onclick="restoreHabit('${habit.id}')">Restore</button></div>`).join('')}</details>` : ''}
    </div>
    <div class="card habit-method-card"><div class="card-title">A kinder way to build a habit</div><p>Choose something small, connect it to a repeatable cue, and make the check-in obvious. There is no universal “21-day” finish line; people and behaviors vary. One miss does not undo the repetitions before it.</p>${evidenceLinks(['habitFormation'])}</div>`;
}

function renderHabitWeek() {
  const today = todayISO();
  const dates = Array.from({ length: 7 }, (_, index) => shiftISODate(today, index - 6));
  let due = 0, done = 0;
  dates.forEach(date => { const summary = habitDaySummary(date); due += summary.scheduled.length; done += summary.completed.length; });
  const rate = due ? Math.round(done / due * 100) : 0;
  return `<div class="card habit-week-card"><div class="card-title"><span>Last 7 days</span><strong>${due ? `${rate}%` : '—'}</strong></div>
    <div class="habit-week-strip">${dates.map(date => { const summary = habitDaySummary(date); const state = !summary.scheduled.length ? 'rest' : summary.allDone ? 'complete' : summary.completed.length ? 'partial' : 'open'; return `<button class="habit-week-day ${state}" onclick="setHabitDate('${date}')" aria-label="View ${date}: ${summary.completed.length} of ${summary.scheduled.length} habits"><span>${HABIT_DAY_LABELS[habitDateObject(date).getDay()]}</span><b>${habitDateObject(date).getDate()}</b></button>`; }).join('')}</div>
    <p class="hint">Based only on habits scheduled for each day. Unscheduled days never count against you.</p></div>`;
}

function renderHabitStarterState() {
  return `<div class="habit-starter"><p>Start with one action that feels almost too easy. You can edit every detail.</p><div class="habit-template-grid">
    ${Object.entries(HABIT_TEMPLATES).map(([key, habit]) => `<button onclick="startHabitTemplate('${key}')"><span>${renderHabitIcon(habit.icon)}</span><strong>${escapeAttr(habit.name)}</strong><small>${escapeAttr(habit.cue)}</small></button>`).join('')}
  </div></div>`;
}

function renderHabitManageRow(habit) {
  const schedule = habit.days.length === 7 ? 'Daily' : habit.days.map(day => HABIT_DAY_LABELS[day]).join(' · ');
  const effort = { easy: 'Easy win', medium: 'Some effort', hard: 'Hard / stretch' }[habit.difficulty] || 'Easy win';
  const best = habitBestStreak(habit);
  return `<div class="habit-manage-row"><span class="habit-manage-icon">${renderHabitIcon(habit.icon)}</span><div><strong>${escapeAttr(habit.name)}</strong><small>${escapeAttr(schedule)} · ${effort}${habit.cue ? ` · ${escapeAttr(habit.cue)}` : ''} · Best ${best}</small></div><button class="btn btn-sm" onclick="openHabitEditor('${habit.id}')">Edit</button></div>`;
}

function blankHabitDraft() {
  return { id: null, name: '', icon: '2705', cue: '', difficulty: 'easy', target: 1, days: [0,1,2,3,4,5,6] };
}

function openHabitEditor(id) {
  const habit = id ? STATE.habits.items.find(item => item.id === id) : null;
  UI.habitDraft = habit ? { ...habit, days: [...habit.days] } : blankHabitDraft();
  UI.habitEditorOpen = true;
  render();
}

function closeHabitEditor() {
  UI.habitEditorOpen = false;
  UI.habitDraft = null;
  render();
}

function startHabitTemplate(key) {
  const template = HABIT_TEMPLATES[key];
  if (!template) return;
  UI.habitDraft = { ...blankHabitDraft(), ...template, days: [...template.days] };
  UI.habitEditorOpen = true;
  render();
}

function updateHabitDraft(field, value) {
  if (!UI.habitDraft) UI.habitDraft = blankHabitDraft();
  if (field === 'target') UI.habitDraft.target = Math.max(1, Math.min(20, Math.round(Number(value) || 1)));
  else UI.habitDraft[field] = value;
}

function toggleHabitDraftDay(day) {
  const days = new Set(UI.habitDraft?.days || []);
  if (days.has(day) && days.size > 1) days.delete(day); else days.add(day);
  UI.habitDraft.days = Array.from(days).sort((a, b) => a - b);
  render();
}

function setHabitDraftDays(preset) {
  const presets = { daily: [0,1,2,3,4,5,6], weekdays: [1,2,3,4,5], weekends: [0,6] };
  UI.habitDraft.days = [...(presets[preset] || presets.daily)];
  render();
}

function renderHabitEditor() {
  const draft = UI.habitDraft || blankHabitDraft();
  return `<form class="habit-editor" onsubmit="saveHabit(event)">
    <div class="field"><label>Choose an icon</label><div class="habit-icon-grid">${HABIT_ICONS.map(icon => `<button type="button" class="habit-icon-choice ${draft.icon === icon.key ? 'active' : ''}" onclick="updateHabitDraft('icon','${icon.key}'); render()" aria-label="${escapeAttr(icon.label)}" aria-pressed="${draft.icon === icon.key}">${openMojiIcon(icon.key, '')}</button>`).join('')}</div></div>
    <div class="field"><label for="habit-name">Habit</label><input id="habit-name" data-focus-id="habit-name" maxlength="80" required placeholder="Example: Walk for 10 minutes" value="${escapeAttr(draft.name)}" oninput="updateHabitDraft('name',this.value)"></div>
    <div class="field"><label for="habit-cue">When / cue <span class="optional">optional</span></label><input id="habit-cue" data-focus-id="habit-cue" maxlength="100" placeholder="Example: After breakfast" value="${escapeAttr(draft.cue || '')}" oninput="updateHabitDraft('cue',this.value)"><p class="hint">A consistent moment or routine makes the next action easier to remember.</p></div>
    <div class="field-row"><div class="field"><label for="habit-target">Times per scheduled day</label><input id="habit-target" type="number" inputmode="numeric" min="1" max="20" value="${draft.target}" onchange="updateHabitDraft('target',this.value)"></div>
      <div class="field"><label for="habit-difficulty">How it feels</label><select id="habit-difficulty" onchange="updateHabitDraft('difficulty',this.value)"><option value="easy" ${draft.difficulty === 'easy' ? 'selected' : ''}>Easy win</option><option value="medium" ${draft.difficulty === 'medium' ? 'selected' : ''}>Some effort</option><option value="hard" ${draft.difficulty === 'hard' ? 'selected' : ''}>Hard / stretch</option></select></div></div>
    <div class="field"><label>Scheduled days</label><div class="habit-presets"><button type="button" class="chip" onclick="setHabitDraftDays('daily')">Daily</button><button type="button" class="chip" onclick="setHabitDraftDays('weekdays')">Weekdays</button><button type="button" class="chip" onclick="setHabitDraftDays('weekends')">Weekends</button></div>
      <div class="habit-day-picker">${HABIT_DAY_LABELS.map((label, day) => `<button type="button" class="${draft.days.includes(day) ? 'active' : ''}" onclick="toggleHabitDraftDay(${day})" aria-pressed="${draft.days.includes(day)}"><span>${label}</span><small>${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]}</small></button>`).join('')}</div></div>
    <div class="habit-editor-actions"><button type="submit" class="btn btn-primary">${draft.id ? 'Save changes' : 'Add habit'}</button><button type="button" class="btn" onclick="closeHabitEditor()">Cancel</button>${draft.id ? `<button type="button" class="btn habit-archive-btn" onclick="archiveHabit('${draft.id}')">Archive</button>` : ''}</div>
  </form>`;
}

function saveHabit(event) {
  event.preventDefault();
  const draft = UI.habitDraft || blankHabitDraft();
  const name = String(draft.name || '').trim();
  if (!name) { toast('Give this habit a name.'); return; }
  const item = {
    id: draft.id || uid(), name: name.slice(0, 80), icon: HABIT_ICONS.some(icon => icon.key === draft.icon) ? draft.icon : '2705',
    cue: String(draft.cue || '').trim().slice(0, 100), difficulty: ['easy','medium','hard'].includes(draft.difficulty) ? draft.difficulty : 'easy',
    target: Math.max(1, Math.min(20, Math.round(Number(draft.target) || 1))), days: [...new Set(draft.days || [0,1,2,3,4,5,6])].sort(),
    createdDate: draft.createdDate || todayISO(), archivedAt: null,
  };
  const index = STATE.habits.items.findIndex(habit => habit.id === item.id);
  if (index >= 0) STATE.habits.items[index] = item; else STATE.habits.items.push(item);
  UI.habitEditorOpen = false; UI.habitDraft = null;
  persist(); toast(index >= 0 ? 'Habit updated.' : 'Habit added.'); render();
}

function archiveHabit(id) {
  const habit = STATE.habits.items.find(item => item.id === id);
  if (!habit) return;
  habit.archivedAt = todayISO();
  UI.habitEditorOpen = false; UI.habitDraft = null;
  persist(); toast('Habit archived. Its history is still here.'); render();
}

function restoreHabit(id) {
  const habit = STATE.habits.items.find(item => item.id === id);
  if (!habit) return;
  habit.archivedAt = null;
  persist(); toast('Habit restored for today.'); render();
}

function shiftHabitDate(amount) {
  const next = shiftISODate(UI.habitDate || todayISO(), amount);
  UI.habitDate = next > todayISO() ? todayISO() : next;
  render();
}

function setHabitDate(date) {
  UI.habitDate = date > todayISO() ? todayISO() : date;
  render();
}
