/* ============================================================
   WEIGHT GOALS VIEW
   ============================================================ */

let _goalChart = null;

function renderGoals() {
  const g = STATE.goal;
  const p = STATE.profile;
  const isImperial = p.unitSystem === 'imperial';
  const unit = isImperial ? 'lb' : 'kg';
  const toDisplay = kg => kg == null ? '' : (isImperial ? kgToLb(kg).toFixed(1) : kg.toFixed(1));
  const cur = currentWeightKg();
  const tdee = getTDEE();
  const effTdee = getEffectiveTDEE();

  const hasGoal = g.targetWeightKg != null && g.targetDate;
  let evalResult = null;
  if (hasGoal) {
    evalResult = evaluateGoal({
      startWeightKg: g.startWeightKg ?? cur,
      targetWeightKg: g.targetWeightKg,
      startDate: g.startDate ?? todayISO(),
      targetDate: g.targetDate,
      tdee: effTdee,
    });
  }

  const progressPct = hasGoal ? goalProgressPct(g.startWeightKg ?? cur, cur, g.targetWeightKg) : 0;

  return `
    <div class="page-head">
      <p class="page-eyebrow">Trajectory</p>
      <h1 class="page-title">Weight goal</h1>
      <p class="page-sub">Set where you want to be and by when. We'll show your required rate of change and whether it's realistic - no scare tactics, just the math.</p>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">Set your goal</div>
        <div class="field">
          <label>Target weight (${unit})</label>
          <input type="number" data-focus-id="goal-target-weight" step="0.1" value="${toDisplay(g.targetWeightKg)}" oninput="updateGoalTargetWeight(this.value)">
        </div>
        <div class="field">
          <label>Target date</label>
          <input type="date" data-focus-id="goal-target-date" value="${g.targetDate || ''}" oninput="updateGoalField('targetDate', this.value)">
        </div>
        <p class="hint">Starting point locked at ${toDisplay(g.startWeightKg ?? cur)} ${unit} on ${g.startDate ?? todayISO()} the first time you set a goal. <button class="btn btn-ghost btn-sm" onclick="resetGoalStart()">Reset start point to today</button></p>
      </div>

      <div class="card">
        <div class="card-title">Current status</div>
        <div class="grid grid-2" style="margin-bottom: 10px;">
          <div class="stat"><div class="stat-label">Current</div><div class="stat-value">${toDisplay(cur)}<span class="unit">${unit}</span></div></div>
          <div class="stat"><div class="stat-label">Target</div><div class="stat-value accent">${g.targetWeightKg != null ? toDisplay(g.targetWeightKg) : '-'}<span class="unit">${unit}</span></div></div>
        </div>
        ${hasGoal ? `
          <div class="progress-track"><div class="progress-fill" style="width:${progressPct.toFixed(0)}%"></div></div>
          <div class="progress-labels">
            <span>${toDisplay(g.startWeightKg ?? cur)} ${unit}</span>
            <span>${progressPct.toFixed(0)}% there</span>
            <span>${toDisplay(g.targetWeightKg)} ${unit}</span>
          </div>
        ` : `<div class="hint">Set a target to see progress.</div>`}
      </div>
    </div>

    ${evalResult && !evalResult.error ? renderFeasibilityCard(evalResult, isImperial, tdee, effTdee) : ''}
    ${evalResult && evalResult.error ? `<div class="card"><div class="section-note">${evalResult.error}</div></div>` : ''}

    <div class="card">
      <div class="card-title">
        Weight log
        <button class="btn btn-sm" onclick="openLogWeightPrompt()">+ Log today's weight</button>
      </div>
      <canvas id="goal-chart" height="90"></canvas>
      ${STATE.weightLog.length === 0 ? `<div class="empty-state">No entries yet - log your weight to start the trend line.</div>` : ''}
    </div>
  `;
}

function renderFeasibilityCard(evalResult, isImperial, tdee, effTdee) {
  const { ratePerWeekLb, feasibility, suggestedIntake, deltaLb, weeks } = evalResult;
  const rateDisplay = isImperial ? `${Math.abs(ratePerWeekLb).toFixed(2)} lb/week` : `${Math.abs(lbToKg(ratePerWeekLb)).toFixed(2)} kg/week`;
  const direction = deltaLb < 0 ? 'loss' : deltaLb > 0 ? 'gain' : 'maintenance';

  const badgeClass = feasibility === 'reasonable' ? 'badge-ok' : feasibility === 'ambitious' ? 'badge-warn' : 'badge-danger';
  const badgeText = feasibility === 'reasonable' ? 'On track' : feasibility === 'ambitious' ? 'Ambitious' : 'Unlikely as set';

  const messages = {
    reasonable: `This is a well-supported, sustainable rate of ${direction}.`,
    ambitious: `This is faster than typically recommended, but achievable with consistent adherence.`,
    unlikely: `Based on standard energy-balance math, hitting this exact date is unlikely without extreme measures. Consider extending your timeline or adjusting the target, the math below shows why.`,
  };

  const stepBonus = getStepBonus();

  return `
    <div class="card">
      <div class="card-title">Feasibility check <span class="badge ${badgeClass}">${badgeText}</span></div>
      <div class="grid grid-3" style="margin-bottom:12px;">
        <div class="stat"><div class="stat-label">Required rate</div><div class="stat-value">${rateDisplay}</div></div>
        <div class="stat"><div class="stat-label">Timeframe</div><div class="stat-value">${weeks.toFixed(1)}<span class="unit">wks</span></div></div>
        <div class="stat"><div class="stat-label">Suggested daily intake</div><div class="stat-value accent">${suggestedIntake ? Math.round(suggestedIntake) : '-'}<span class="unit">kcal</span></div></div>
      </div>
      <p class="hint" style="font-size:13px; line-height:1.6;">${messages[feasibility]}
        ${effTdee ? ` Your current maintenance is ~${Math.round(effTdee)} kcal/day (TDEE of ${Math.round(tdee)}${stepBonus.dailyKcal > 0 ? ` plus a ${Math.round(stepBonus.dailyKcal)} kcal step bonus` : ''}).` : ' Fill in your profile on Home to see a suggested intake target.'}
      </p>
    </div>
  `;
}

function drawGoalChart() {
  const canvas = document.getElementById('goal-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  const log = STATE.weightLog;
  const isImperial = STATE.profile.unitSystem === 'imperial';
  const toDisplay = kg => isImperial ? +kgToLb(kg).toFixed(1) : +kg.toFixed(1);

  const labels = log.map(e => e.date);
  const data = log.map(e => toDisplay(e.weightKg));

  const points = [...data];
  const pointLabels = [...labels];
  if (STATE.goal.targetWeightKg && STATE.goal.targetDate) {
    pointLabels.push(STATE.goal.targetDate);
    points.push(null); // goal shown via annotation line instead of forcing scale
  }

  if (_goalChart) { _goalChart.destroy(); }
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim();
  const textDim = styles.getPropertyValue('--text-dim').trim();
  const border = styles.getPropertyValue('--border').trim();

  _goalChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `Weight (${isImperial ? 'lb' : 'kg'})`,
        data,
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

function updateGoalTargetWeight(val) {
  const n = numOrNull(val);
  const kg = n != null ? (STATE.profile.unitSystem === 'imperial' ? lbToKg(n) : n) : null;
  ensureGoalStart();
  STATE.goal.targetWeightKg = kg;
  persist(); render();
}

function updateGoalField(field, val) {
  ensureGoalStart();
  STATE.goal[field] = val;
  persist(); render();
}

function ensureGoalStart() {
  if (!STATE.goal.startDate) {
    STATE.goal.startDate = todayISO();
    STATE.goal.startWeightKg = currentWeightKg();
  }
}

function resetGoalStart() {
  STATE.goal.startDate = todayISO();
  STATE.goal.startWeightKg = currentWeightKg();
  persist(); render();
}

function openLogWeightPrompt() {
  const isImperial = STATE.profile.unitSystem === 'imperial';
  const val = prompt(`Log today's weight (${isImperial ? 'lb' : 'kg'}):`);
  if (val === null) return;
  const n = numOrNull(val);
  if (n == null) return;
  const kg = isImperial ? lbToKg(n) : n;
  logWeightEntry(kg);
  STATE.profile.weightKg = kg;
  persist(); render();
  toast('Weight logged');
}
