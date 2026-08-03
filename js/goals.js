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

    ${renderGoalFocusCard()}

    <div class="grid grid-2">
      <div class="card ${onboardingStepIs('weight_goal') ? 'onboarding-focus' : ''}">
        <div class="card-title">Set your goal</div>
        <div class="field">
          <label>Target weight (${unit})</label>
          <input type="number" data-focus-id="goal-target-weight" step="0.1" value="${toDisplay(g.targetWeightKg)}" onchange="updateGoalTargetWeight(this.value)" onkeydown="if(event.key==='Enter') this.blur()">
        </div>
        ${g.targetDate ? `
          <div class="date-nav-row">
            ${renderDatePrevButton('shiftGoalTargetDate')}
            <div class="field date-nav-bar" style="margin-bottom:0;">
              <label>Target date</label>
              <input type="date" data-focus-id="goal-target-date" value="${g.targetDate}" onchange="updateGoalField('targetDate', this.value)">
            </div>
            ${renderDateNextButton('shiftGoalTargetDate')}
          </div>
        ` : `
          <div class="field">
            <label>Target date</label>
            <input type="date" data-focus-id="goal-target-date" value="" onchange="updateGoalField('targetDate', this.value)">
          </div>
        `}
        <div class="chip-row" style="margin-bottom:10px;">
          ${[['1 month', 30], ['3 months', 91], ['6 months', 182], ['1 year', 365]].map(([label, days]) => `<button class="chip" onclick="setGoalTargetDateFromToday(${days})">+${label}</button>`).join('')}
        </div>
        <p class="hint" style="margin-bottom:10px;">Typing a distant year into the date field directly can be fiddly (a native browser quirk, not something we can fully fix), the shortcuts above set a target date without needing to.</p>
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

    <div class="card ${onboardingStepIs('weight_log') ? 'onboarding-focus' : ''}">
      <div class="card-title">
        Weight log
        <button class="btn btn-sm" onclick="openLogWeightPrompt()">+ Log today's weight</button>
      </div>
      <canvas id="goal-chart" height="90"></canvas>
      ${STATE.weightLog.length === 0 ? `<div class="empty-state">No entries yet - log your weight to start the trend line.</div>` : ''}
    </div>
  `;
}

function renderGoalFocusCard() {
  const guidance = getGoalGuidance();
  const expert = (STATE.uiPrefs.knowledgeLevel || 0) >= 4;
  const proteinRate = formatProteinRateRange(guidance.proteinMin, guidance.proteinMax);
  return `
    <div class="card goal-focus-card ${onboardingStepIs('goal_focus') ? 'onboarding-focus' : ''}">
      <div class="card-title">What result matters most?</div>
      <div class="chip-row goal-focus-options">
        ${GOAL_FOCUS_OPTIONS.map(option => `<button class="chip ${guidance.focus.key === option.key ? 'active' : ''}" onclick="setGoalFocus('${option.key}')">${escapeAttr(option.label)}</button>`).join('')}
      </div>
      <div class="field" style="max-width:340px; margin-top:12px;">
        <label for="training-experience">Structured training history</label>
        <select id="training-experience" data-focus-id="training-experience" onchange="setTrainingExperience(this.value)">
          ${TRAINING_EXPERIENCE_OPTIONS.map(option => `<option value="${option.key}" ${guidance.experience.key === option.key ? 'selected' : ''}>${escapeAttr(option.label)}</option>`).join('')}
        </select>
      </div>
      <div class="goal-guidance-summary">
        <strong>${escapeAttr(guidance.focus.label)}</strong>
        <p>${escapeAttr(guidance.focus.short)}</p>
        ${guidance.proteinLowGrams ? `<p><strong>Protein planning range:</strong> ${guidance.proteinLowGrams}-${guidance.proteinHighGrams} g/day (${proteinRate} using a ${formatWeightKg(guidance.proteinReferenceKg, 0)} reference).</p>` : '<p>Add your current weight to calculate a protein planning range.</p>'}
        <p><strong>Carbohydrate and fat:</strong> Forge turns your calorie target into a balanced starting allocation on Food Tracking; neither macro is being ignored.</p>
        ${expert ? '' : `<p><strong>Energy:</strong> ${escapeAttr(guidance.energy)}</p><p><strong>Training:</strong> ${escapeAttr(guidance.training)}</p><p>${escapeAttr(guidance.nuance)}</p>`}
      </div>
      <details class="evidence-details">
        <summary>Evidence and limitations</summary>
        <p>These are adult planning ranges, not diagnoses or individualized medical nutrition therapy. Forge does not infer a goal from body size and does not silently change calorie targets; your selected weight/date still controls the calorie math.</p>
        <ul>${GUIDANCE_EVIDENCE.map(source => `<li><a href="${source.url}" target="_blank" rel="noopener noreferrer">${escapeAttr(source.label)}</a> — ${escapeAttr(formatGuidanceEvidenceNote(source))}</li>`).join('')}</ul>
      </details>
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
    const yIso = dateToLocalISO(yesterday);
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
  const { ratePerWeekLb, ratePctBodyWeightPerWeek, feasibility, suggestedIntake, unsafeTarget, deltaLb, weeks } = evalResult;
  const rateDisplay = isImperial ? `${Math.abs(ratePerWeekLb).toFixed(2)} lb/week` : `${Math.abs(lbToKg(ratePerWeekLb)).toFixed(2)} kg/week`;
  const direction = deltaLb < 0 ? 'loss' : deltaLb > 0 ? 'gain' : 'maintenance';

  const badgeClass = feasibility === 'reasonable' ? 'badge-ok' : feasibility === 'ambitious' ? 'badge-warn' : 'badge-danger';
  const badgeText = feasibility === 'reasonable' ? 'On track' : feasibility === 'ambitious' ? 'Ambitious' : 'Unlikely as set';

  const messages = {
    reasonable: `This is within a commonly used planning range for ${direction}, but individual response still varies.`,
    ambitious: `This is faster than the usual planning range. Extend the timeline if recovery, hunger, performance, or adherence starts to suffer.`,
    unlikely: `Based on this first-pass energy model, Forge should not turn this date into an intake prescription. Extend the timeline or adjust the target.`,
  };

  const stepBonus = getStepBonus();

  return `
    <div class="card">
      <div class="card-title">Feasibility check <span class="badge ${badgeClass}">${badgeText}</span></div>
      <div class="grid grid-3" style="margin-bottom:12px;">
        <div class="stat"><div class="stat-label">Required rate</div><div class="stat-value">${rateDisplay}</div><div class="hint">${ratePctBodyWeightPerWeek != null ? ratePctBodyWeightPerWeek.toFixed(2) : '-'}% of starting weight/week</div></div>
        <div class="stat"><div class="stat-label">Timeframe</div><div class="stat-value">${weeks.toFixed(1)}<span class="unit">wks</span></div></div>
        <div class="stat"><div class="stat-label">Suggested daily intake</div><div class="stat-value accent">${suggestedIntake ? Math.round(suggestedIntake) : 'Not provided'}${suggestedIntake ? '<span class="unit">kcal</span>' : ''}</div></div>
      </div>
      <p class="hint" style="font-size:13px; line-height:1.6;">${messages[feasibility]}
        ${unsafeTarget ? ' This timeline would require an intake or deficit that Forge should not prescribe. Extend the target date; the Food page will keep showing estimated maintenance rather than turning an unsafe calculation into a target.' : ''}
        ${effTdee ? ` Your current maintenance is ~${Math.round(effTdee)} kcal/day (TDEE of ${Math.round(tdee)}${stepBonus.dailyKcal > 0 ? ` plus a ${Math.round(stepBonus.dailyKcal)} kcal step bonus` : ''}).` : ' Fill in your profile on Home to see a suggested intake target.'}
        This first-pass projection uses the familiar ${isImperial ? '~3,500 kcal-per-pound' : '~7,700 kcal-per-kilogram'} approximation. Human weight change is dynamic: energy needs and water weight change over time, so use the trend to adjust rather than treating the projection as a promise.
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
  if (!log.length && !hasGoal) return;

  // Anchor the x-axis at day 0 = the earliest relevant date, and plot everything
  // by real elapsed days (a linear scale), not by evenly-spaced label index. That's
  // what makes a target 22 weeks out actually look 22 weeks out, rather than
  // getting squashed next to a cluster of early check-ins.
  const allDates = log.map(e => e.date).concat(hasGoal ? [g.startDate, g.targetDate] : []).sort();
  const anchorMs = new Date(allDates[0] + 'T00:00:00').getTime();
  const dayOffset = dateStr => Math.round((new Date(dateStr + 'T00:00:00').getTime() - anchorMs) / 86400000);

  const actualPoints = log.map(e => ({ x: dayOffset(e.date), y: toDisplay(e.weightKg) }));

  let trajectoryPoints = null;
  if (hasGoal) {
    trajectoryPoints = [
      { x: dayOffset(g.startDate), y: toDisplay(g.startWeightKg) },
      { x: dayOffset(g.targetDate), y: toDisplay(g.targetWeightKg) },
    ];
  }

  // Label the x-axis only at dates you actually logged (plus start/target),
  // rather than a dense auto-generated grid, keeps it readable at a glance.
  const tickDates = Array.from(new Set(log.map(e => e.date).concat(hasGoal ? [g.startDate, g.targetDate] : []))).sort();
  const tickMap = new Map(tickDates.map(d => [dayOffset(d), d.slice(5)])); // 'MM-DD'

  if (_goalChart) { _goalChart.destroy(); }
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim();
  const accent2 = styles.getPropertyValue('--accent-2').trim();
  const textDim = styles.getPropertyValue('--text-dim').trim();
  const border = styles.getPropertyValue('--border').trim();

  const datasets = [{
    label: `Actual weight (${isImperial ? 'lb' : 'kg'})`,
    data: actualPoints,
    borderColor: accent,
    backgroundColor: accent + '33',
    tension: 0.3,
    fill: true,
    pointRadius: 3,
  }];
  if (trajectoryPoints) {
    datasets.push({
      label: 'Target pace',
      data: trajectoryPoints,
      borderColor: accent2,
      backgroundColor: 'transparent',
      borderDash: [6, 4],
      tension: 0,
      fill: false,
      pointRadius: 0,
    });
  }

  _goalChart = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { display: !!trajectoryPoints, labels: { color: textDim, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { title: (items) => tickMap.get(items[0].parsed.x) || `Day ${items[0].parsed.x}` } },
      },
      scales: {
        x: {
          type: 'linear',
          ticks: {
            color: textDim,
            callback: (value) => tickMap.get(value) || '',
            maxRotation: 0,
          },
          afterBuildTicks: (axis) => {
            axis.ticks = Array.from(tickMap.keys()).sort((a, b) => a - b).map(v => ({ value: v }));
          },
          grid: { color: border },
        },
        y: { ticks: { color: textDim }, grid: { color: border } },
      },
    },
  });
}

function updateGoalTargetWeight(val) {
  const n = numOrNull(val);
  const kg = n != null ? (STATE.profile.unitSystem === 'imperial' ? lbToKg(n) : n) : null;
  if (kg != null && (kg < 20 || kg > 400)) { toast(usesImperialUnits() ? 'Enter a target weight between 44 and 882 lb.' : 'Enter a target weight between 20 and 400 kg.'); render(); return; }
  ensureGoalStart();
  STATE.goal.targetWeightKg = kg;
  persist(); render();
}

function updateGoalField(field, val) {
  if (field === 'targetDate' && !isReasonableDateString(val)) {
    toast("That doesn't look like a valid date, try again");
    render();
    return;
  }
  ensureGoalStart();
  STATE.goal[field] = val;
  persist(); render();
}

function setGoalTargetDateFromToday(daysFromNow) {
  const d = new Date(todayISO() + 'T00:00:00');
  d.setDate(d.getDate() + daysFromNow);
  updateGoalField('targetDate', dateToLocalISO(d));
}

function shiftGoalTargetDate(delta) {
  if (!STATE.goal.targetDate) return;
  const d = new Date(STATE.goal.targetDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  updateGoalField('targetDate', dateToLocalISO(d));
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
  if (kg < 20 || kg > 400) { toast(usesImperialUnits() ? 'Enter a weight between 44 and 882 lb.' : 'Enter a weight between 20 and 400 kg.'); return; }
  logWeightEntry(kg);
  markOnboarding('weightLoggedOnGoals');
  STATE.profile.weightKg = kg;
  persist(); render();
  toast('Weight logged');
}
