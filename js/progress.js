/* ============================================================
   PROGRESS VIEW
   Charts strength/volume over time per exercise, pulled from the
   dated Workout Log (not the weekly Plan template).
   ============================================================ */

let _progressChart = null;

// Collects every distinct exercise that appears anywhere in the log, with a
// human label, so the picker only shows things the person has actually logged.
function getLoggedExerciseOptions() {
  const seen = new Map(); // key -> label
  Object.values(STATE.workoutLog).forEach(entries => {
    entries.forEach(e => {
      if (e.exerciseId) {
        const ex = EXERCISE_LIBRARY.find(x => x.id === e.exerciseId);
        if (ex) seen.set('id:' + ex.id, ex.name);
      } else if (e.custom) {
        seen.set('custom:' + e.custom.name, e.custom.name);
      }
    });
  });
  return Array.from(seen.entries()).map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
}

// Builds a date-ordered series of {date, value, unit} for one exercise key.
function getExerciseHistory(key) {
  const dates = Object.keys(STATE.workoutLog).sort();
  const points = [];
  dates.forEach(date => {
    const entries = STATE.workoutLog[date].filter(e =>
      key.startsWith('id:') ? e.exerciseId === key.slice(3) : (e.custom && e.custom.name === key.slice(7))
    );
    if (!entries.length) return;
    const ex = EXERCISE_LIBRARY.find(x => x.id === entries[0].exerciseId) || entries[0].custom;
    let value, unit;
    if (ex.inputMode === 'setsRepsWeight') {
      value = Math.max(...entries.map(e => kgToLb(effectiveLoadKg(e))));
      unit = 'lb (top load)';
    } else if (ex.inputMode === 'setsReps') {
      value = entries.reduce((s, e) => s + (Number(e.sets) || 0) * (Number(e.reps) || 0), 0);
      unit = 'total reps';
    } else {
      value = entries.reduce((s, e) => s + (Number(e.durationMin) || 0), 0);
      unit = 'minutes';
    }
    points.push({ date, value, unit });
  });
  return points;
}

// Finds the most recent full entry (not just its chart value) logged for an
// exercise key, used for the strength-standard comparison below.
function getMostRecentEntryForExercise(key) {
  const dates = Object.keys(STATE.workoutLog).sort().reverse();
  for (const date of dates) {
    const match = (STATE.workoutLog[date] || []).find(e =>
      key.startsWith('id:') ? e.exerciseId === key.slice(3) : (e.custom && e.custom.name === key.slice(7))
    );
    if (match) return { entry: match, date };
  }
  return null;
}

function renderStandingCard(standing, exerciseId) {
  const isLoadBased = !!STRENGTH_STANDARDS[exerciseId];
  const nextTargetText = standing.nextTargetDisplay != null
    ? (isLoadBased ? `${Math.round(kgToLb(standing.nextTargetDisplay))} lb` : `${Math.round(standing.nextTargetDisplay)} reps`)
    : null;
  return `
    <div class="card">
      <div class="card-title">
        Where you rank
        ${tip('ⓘ', 'About these standards', 'These are rough bodyweight-ratio reference points, not a measured fact about you. Use them as motivation and a general sense of direction, not a precise ranking, individual factors (training history, limb length, age) shift things a lot.')}
      </div>
      <div class="stat" style="margin-bottom:10px;">
        <div class="stat-label">Estimated level</div>
        <div class="stat-value accent" style="font-size:24px;">${standing.label}</div>
      </div>
      ${standing.nextLabel ? `<p class="hint">Reach about ${nextTargetText} to hit "${standing.nextLabel}."</p>` : `<p class="hint">Already at the top reference tier here, nice work.</p>`}
    </div>
  `;
}

function renderProgress() {
  const options = getLoggedExerciseOptions();
  if (!UI.progressExerciseId && options.length) UI.progressExerciseId = options[0].key;
  const history = UI.progressExerciseId ? getExerciseHistory(UI.progressExerciseId) : [];
  const selectedLabel = options.find(o => o.key === UI.progressExerciseId)?.label;

  const first = history[0];
  const last = history[history.length - 1];
  const change = first && last && history.length > 1 ? last.value - first.value : null;

  let standingCard = '';
  if (UI.progressExerciseId && UI.progressExerciseId.startsWith('id:')) {
    const exerciseId = UI.progressExerciseId.slice(3);
    const hasStandard = STRENGTH_STANDARDS[exerciseId] || STRENGTH_STANDARDS_REPS[exerciseId];
    const bw = currentWeightKg();
    if (hasStandard && bw) {
      const recent = getMostRecentEntryForExercise(UI.progressExerciseId);
      if (recent) {
        let standing = null;
        if (STRENGTH_STANDARDS[exerciseId]) {
          standing = getStrengthStanding({ exerciseId, valueKg: effectiveLoadKg(recent.entry), bodyweightKg: bw, sex: STATE.profile.sex });
        } else if (recent.entry.reps != null) {
          standing = getStrengthStanding({ exerciseId, reps: Number(recent.entry.reps) || 0, bodyweightKg: bw, sex: STATE.profile.sex });
        }
        if (standing) standingCard = renderStandingCard(standing, exerciseId);
      }
    }
  }

  return `
    <div class="page-head">
      <p class="page-eyebrow">History</p>
      <h1 class="page-title">Progress</h1>
      <p class="page-sub">Pulled from your Workout Log. Log the same exercise on different days to start seeing a trend here, watching a number go up over weeks is one of the best motivators there is.</p>
    </div>

    ${!options.length ? `
      <div class="card"><div class="empty-state"><div class="big">-</div>Nothing logged yet. Head to the Workout Log page and log a few sessions, then come back here to see the trend.</div></div>
    ` : `
      <div class="card">
        <div class="field" style="max-width:340px;">
          <label>Exercise</label>
          <select data-focus-id="progress-exercise" onchange="setProgressExercise(this.value)">
            ${options.map(o => `<option value="${o.key}" ${o.key === UI.progressExerciseId ? 'selected' : ''}>${escapeAttr(o.label)}</option>`).join('')}
          </select>
        </div>

        ${history.length ? `
          <div class="grid grid-3" style="margin: 16px 0;">
            <div class="stat"><div class="stat-label">Sessions logged</div><div class="stat-value" style="font-size:22px;">${history.length}</div></div>
            <div class="stat"><div class="stat-label">Most recent</div><div class="stat-value accent" style="font-size:22px;">${Math.round(last.value)}<span class="unit">${last.unit}</span></div></div>
            <div class="stat">
              <div class="stat-label">Change since first log</div>
              <div class="stat-value" style="font-size:22px; color:${change > 0 ? 'var(--ok)' : change < 0 ? 'var(--text-dim)' : 'var(--text)'};">${change != null ? (change > 0 ? '+' : '') + Math.round(change) : '-'}</div>
            </div>
          </div>
          <canvas id="progress-chart" height="90"></canvas>
        ` : `<div class="empty-state">No history yet for "${escapeAttr(selectedLabel || '')}".</div>`}
      </div>

      ${standingCard}
    `}
  `;
}

function setProgressExercise(key) {
  UI.progressExerciseId = key;
  render();
}

function drawProgressChart() {
  const canvas = document.getElementById('progress-chart');
  if (!canvas || typeof Chart === 'undefined' || !UI.progressExerciseId) return;
  const history = getExerciseHistory(UI.progressExerciseId);
  if (!history.length) return;

  if (_progressChart) { _progressChart.destroy(); }
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim();
  const textDim = styles.getPropertyValue('--text-dim').trim();
  const border = styles.getPropertyValue('--border').trim();

  _progressChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: history.map(p => p.date),
      datasets: [{
        label: history[0].unit,
        data: history.map(p => +p.value.toFixed(1)),
        borderColor: accent,
        backgroundColor: accent + '33',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textDim }, grid: { color: border } },
        y: { ticks: { color: textDim }, grid: { color: border } },
      },
    },
  });
}
