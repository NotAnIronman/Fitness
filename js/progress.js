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

function renderProgress() {
  const options = getLoggedExerciseOptions();
  if (!UI.progressExerciseId && options.length) UI.progressExerciseId = options[0].key;
  const history = UI.progressExerciseId ? getExerciseHistory(UI.progressExerciseId) : [];
  const selectedLabel = options.find(o => o.key === UI.progressExerciseId)?.label;

  const first = history[0];
  const last = history[history.length - 1];
  const change = first && last && history.length > 1 ? last.value - first.value : null;

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
