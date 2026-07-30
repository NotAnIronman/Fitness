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
          <input type="number" data-focus-id="goal-target-weight" step="0.1" value="${toDisplay(g.targetWeightKg)}" onchange="updateGoalTargetWeight(this.value)" onkeydown="if(event.key==='Enter') this.blur()">
        </div>
        <div class="field-row" style="align-items:end;">
          <div class="field" style="margin-bottom:0; flex:1;">
            <label>Target date</label>
            <input type="date" data-focus-id="goal-target-date" value="${g.targetDate || ''}" onchange="updateGoalField('targetDate', this.value)">
          </div>
          ${g.targetDate ? renderDateArrows('shiftGoalTargetDate') : ''}
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

    ${hasGoal ? renderPaceFeedback(isImperial) : ''}

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

// Compares your most recent logged weight against where the straight-line
// trajectory (start -> target, by date) says you "should" be, and gives
// encouraging, specific feedback either way. If you're behind pace, it also
// checks whether food was logged the day before, since that's usually the
// biggest lever and a gap there is worth naming plainly (not as a scolding,
// just as the most likely explanation).
function renderPaceFeedback(isImperial) {
  const log = STATE.weightLog;
  if (!log.length) return '';
  const g = STATE.goal;
  if (!g.startWeightKg || !g.startDate) return '';
  const latest = log[log.length - 1];
  const startMs = new Date(g.startDate).getTime();
  const targetMs = new Date(g.targetDate).getTime();
  const span = targetMs - startMs;
  if (span <= 0) return '';
  const t = (new Date(latest.date).getTime() - startMs) / span;
  const expectedKg = g.startWeightKg + (g.targetWeightKg - g.startWeightKg) * Math.max(0, t);
  const diffKg = latest.weightKg - expectedKg; // positive = heavier than the trajectory expects
  const losing = g.targetWeightKg < g.startWeightKg;
  const toDisplay = kg => isImperial ? kgToLb(Math.abs(kg)).toFixed(1) + ' lb' : Math.abs(kg).toFixed(1) + ' kg';

  // Tolerance band so ordinary day-to-day water-weight noise doesn't read as "off pace."
  const toleranceKg = Math.max(0.3, g.startWeightKg * 0.004);
  const aheadOrOnPace = losing ? diffKg <= toleranceKg : diffKg >= -toleranceKg;

  let badgeClass, badgeText, message;

  if (aheadOrOnPace) {
    badgeClass = 'badge-ok';
    badgeText = Math.abs(diffKg) <= toleranceKg ? 'On pace' : 'Ahead of pace';
    message = Math.abs(diffKg) <= toleranceKg
      ? `Your latest weigh-in (${latest.date}) is right on your planned trajectory. Nice, steady consistency is exactly what gets this done.`
      : `Your latest weigh-in (${latest.date}) is ${toDisplay(diffKg)} ahead of your planned pace. Great work, just keep in mind a faster start sometimes evens out, so don't panic if it levels off.`;
  } else {
    badgeClass = 'badge-warn';
    badgeText = 'Behind pace';
    const yesterday = new Date(latest.date + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yIso = yesterday.toISOString().slice(0, 10);
    const yEntries = STATE.foodLog[yIso];

    message = `Your latest weigh-in (${latest.date}) is ${toDisplay(diffKg)} behind your planned pace. `;
    if (!yEntries || !yEntries.length) {
      message += `Looks like nothing was logged in Food Tracking the day before, that's worth checking: it's hard to stay on pace with days that aren't tracked at all, even if the eating itself was fine.`;
    } else {
      const target = typeof getFoodTargetCalories === 'function' ? getFoodTargetCalories() : null;
      const kcal = yEntries.reduce((s, e) => s + e.kcal * e.qty, 0);
      if (target && kcal > target * 1.15) {
        message += `The day before was logged at about ${Math.round(kcal)} kcal, above your ${Math.round(target)} kcal target, that's a plausible contributor.`;
      } else {
        message += `The day before was tracked and looked reasonably close to target, so this is most likely normal fluctuation (water, sodium, hormones, timing), not a real setback. The scale rarely moves in a straight line even when everything is on track.`;
      }
    }
  }

  return `
    <div class="card">
      <div class="card-title">How you're tracking <span class="badge ${badgeClass}">${badgeText}</span></div>
      <p class="hint" style="font-size:13px; line-height:1.6;">${message}</p>
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
        This uses the standard ~3,500 kcal-per-pound estimate, a widely used approximation, not an exact prediction: your maintenance calories actually drift a bit as your weight changes, so real-world progress is rarely perfectly linear even when adherence is.
      </p>
    </div>
  `;
}

function drawGoalChart() {
  const canvas = document.getElementById('goal-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  const log = STATE.weightLog;
  const g = STATE.goal;
  const isImperial = STATE.profile.unitSystem === 'imperial';
  const toDisplay = kg => isImperial ? +kgToLb(kg).toFixed(1) : +kg.toFixed(1);
  const hasGoal = g.targetWeightKg != null && g.targetDate && g.startWeightKg != null && g.startDate;

  // Build a single shared, sorted set of date labels: every date you've actually
  // logged, plus the goal's start/target dates so the trajectory line has
  // somewhere to start and end.
  const labelSet = new Set(log.map(e => e.date));
  if (hasGoal) { labelSet.add(g.startDate); labelSet.add(g.targetDate); }
  const labels = Array.from(labelSet).sort();

  const actualByDate = {};
  log.forEach(e => { actualByDate[e.date] = toDisplay(e.weightKg); });
  const actualData = labels.map(d => (d in actualByDate ? actualByDate[d] : null));

  let trajectoryData = null;
  if (hasGoal) {
    const startMs = new Date(g.startDate).getTime();
    const targetMs = new Date(g.targetDate).getTime();
    const span = targetMs - startMs;
    trajectoryData = labels.map(d => {
      const t = span > 0 ? (new Date(d).getTime() - startMs) / span : 0;
      if (t < 0) return null;
      const val = g.startWeightKg + (g.targetWeightKg - g.startWeightKg) * Math.min(t, 1.15); // let it run a little past target
      return toDisplay(val);
    });
  }

  if (_goalChart) { _goalChart.destroy(); }
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim();
  const accent2 = styles.getPropertyValue('--accent-2').trim();
  const textDim = styles.getPropertyValue('--text-dim').trim();
  const border = styles.getPropertyValue('--border').trim();

  const datasets = [{
    label: `Actual weight (${isImperial ? 'lb' : 'kg'})`,
    data: actualData,
    borderColor: accent,
    backgroundColor: accent + '33',
    tension: 0.3,
    fill: true,
    pointRadius: 3,
    spanGaps: true,
  }];
  if (trajectoryData) {
    datasets.push({
      label: 'Target pace',
      data: trajectoryData,
      borderColor: accent2,
      backgroundColor: 'transparent',
      borderDash: [6, 4],
      tension: 0,
      fill: false,
      pointRadius: 0,
      spanGaps: true,
    });
  }

  _goalChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { display: !!trajectoryData, labels: { color: textDim, boxWidth: 12, font: { size: 11 } } } },
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

function shiftGoalTargetDate(delta) {
  if (!STATE.goal.targetDate) return;
  const d = new Date(STATE.goal.targetDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  updateGoalField('targetDate', d.toISOString().slice(0, 10));
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
