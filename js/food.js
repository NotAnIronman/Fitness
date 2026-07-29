/* ============================================================
   FOOD TRACKING VIEW
   ============================================================ */

function renderFood() {
  const date = UI.foodDate;
  const entries = STATE.foodLog[date] || [];
  const tdee = getTDEE();
  const goalAdjustedTarget = getFoodTargetCalories();

  const totals = entries.reduce((acc, e) => {
    acc.kcal += e.kcal * e.qty;
    acc.protein += e.protein * e.qty;
    acc.carbs += e.carbs * e.qty;
    acc.fat += e.fat * e.qty;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const hasKeys = STATE.nutritionixKeys.appId && STATE.nutritionixKeys.appKey;

  return `
    <div class="page-head">
      <p class="page-eyebrow">Nutrition</p>
      <h1 class="page-title">Food log</h1>
      <p class="page-sub">Search foods, log what you eat, and compare against your target — set relative to your goal, not just plain maintenance.</p>
    </div>

    ${!hasKeys ? `
      <div class="section-note">
        Using the built-in offline food list (${FOOD_FALLBACK_DB.length} common items). For full food search, add a free
        <a href="https://www.nutritionix.com/business/api" target="_blank" rel="noopener">Nutritionix API</a> key in
        <a href="#" onclick="navigate('themes'); return false;">Settings</a> — it's the last section on the Themes page.
      </div>
    ` : ''}

    <div class="field" style="max-width:260px; margin-bottom:16px;">
      <label>Date</label>
      <input type="date" value="${date}" oninput="setFoodDate(this.value)">
    </div>

    <div class="grid grid-2" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-title">Log food</div>
        <div class="search-wrap">
          <input type="text" placeholder="Search foods (e.g. chicken breast)" value="${escapeAttr(UI.foodQuery)}"
            oninput="onFoodSearchInput(this.value)">
          ${UI.foodResults.length ? `
            <div class="food-search-results">
              ${UI.foodResults.map((f, i) => `
                <div class="food-search-item" style="cursor:pointer; display:flex; justify-content:space-between;" onclick="addFoodEntry(${i})">
                  <span>${escapeAttr(f.name)}</span>
                  <span style="color:var(--text-dim); font-family:var(--font-mono); font-size:12px;">${Math.round(f.kcal)} kcal</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        ${UI.foodSearchLoading ? `<p class="hint">Searching…</p>` : ''}
      </div>

      <div class="card">
        <div class="card-title">Today's target</div>
        ${goalAdjustedTarget ? `
          <div class="stat" style="margin-bottom:10px;">
            <div class="stat-label">Calorie target</div>
            <div class="stat-value accent">${Math.round(goalAdjustedTarget)}<span class="unit">kcal</span></div>
          </div>
          <div class="stat">
            <div class="stat-label">Logged so far</div>
            <div class="stat-value">${Math.round(totals.kcal)}<span class="unit">kcal</span></div>
          </div>
          <hr class="div">
          ${renderFoodFeedback(totals.kcal, goalAdjustedTarget)}
        ` : `<div class="hint">Set your profile stats (Home) and optionally a weight goal to see a personalized target.</div>`}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Logged today <span style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim);">${entries.length} item(s)</span></div>
      ${entries.length ? `
        <div class="row-list">
          ${entries.map((e, i) => `
            <div class="exercise-row">
              <div>
                <div class="name">${escapeAttr(e.name)} ${e.qty !== 1 ? `× ${e.qty}` : ''}</div>
                <div class="meta">P ${Math.round(e.protein * e.qty)}g · C ${Math.round(e.carbs * e.qty)}g · F ${Math.round(e.fat * e.qty)}g</div>
              </div>
              <div class="kcal">${Math.round(e.kcal * e.qty)} kcal</div>
              <button class="icon-btn" onclick="removeFoodEntry(${i})">✕</button>
            </div>
          `).join('')}
        </div>
      ` : `<div class="empty-state">Nothing logged yet today.</div>`}

      ${entries.length ? `
        <hr class="div">
        <div class="grid grid-3">
          ${renderMacroBar('Protein', totals.protein, '#5EEAD4')}
          ${renderMacroBar('Carbs', totals.carbs, '#F97316')}
          ${renderMacroBar('Fat', totals.fat, '#F5C64C')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderMacroBar(label, grams, color) {
  const kcalPerG = label === 'Fat' ? 9 : 4;
  const pct = Math.min(100, grams / 2); // purely visual scale, caps around 200g
  return `
    <div class="stat">
      <div class="stat-label">${label}</div>
      <div class="stat-value" style="font-size:18px;">${Math.round(grams)}g</div>
      <div class="macro-bar-track" style="margin-top:6px;"><div class="macro-bar-fill" style="width:${pct}%; background:${color};"></div></div>
    </div>
  `;
}

function renderFoodFeedback(logged, target) {
  const diff = logged - target;
  if (Math.abs(diff) < target * 0.05) {
    return `<div class="badge badge-ok">On target</div><p class="hint" style="margin-top:8px;">You're within 5% of your target — nice consistency.</p>`;
  }
  if (diff > 0) {
    return `<div class="badge badge-warn">${Math.round(diff)} kcal over</div><p class="hint" style="margin-top:8px;">You're running above target today. Consider lighter options for your next meal, or a short walk to help close the gap.</p>`;
  }
  return `<div class="badge badge-ok">${Math.round(Math.abs(diff))} kcal under</div><p class="hint" style="margin-top:8px;">You're under target — good if that matches your goal, but don't drop too far below your BMR consistently.</p>`;
}

function getFoodTargetCalories() {
  const tdee = getTDEE();
  if (!tdee) return null;
  const g = STATE.goal;
  if (g.targetWeightKg != null && g.targetDate) {
    const evalResult = evaluateGoal({
      startWeightKg: g.startWeightKg ?? currentWeightKg(),
      targetWeightKg: g.targetWeightKg,
      startDate: g.startDate ?? todayISO(),
      targetDate: g.targetDate,
      tdee,
    });
    if (evalResult && !evalResult.error && evalResult.suggestedIntake) return evalResult.suggestedIntake;
  }
  return tdee;
}

function setFoodDate(date) {
  UI.foodDate = date;
  UI.foodResults = [];
  render();
}

let _foodSearchTimer = null;
function onFoodSearchInput(val) {
  UI.foodQuery = val;
  clearTimeout(_foodSearchTimer);
  if (!val || val.trim().length < 2) {
    UI.foodResults = [];
    render();
    return;
  }
  _foodSearchTimer = setTimeout(() => runFoodSearch(val), 350);
}

async function runFoodSearch(query) {
  const { appId, appKey } = STATE.nutritionixKeys;
  if (appId && appKey) {
    UI.foodSearchLoading = true;
    render();
    try {
      const res = await fetch('https://trackapi.nutritionix.com/v2/natural/nutrients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-id': appId,
          'x-app-key': appKey,
        },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error('Nutritionix request failed');
      const data = await res.json();
      UI.foodResults = (data.foods || []).map(f => ({
        name: `${f.food_name} (${f.serving_qty} ${f.serving_unit})`,
        kcal: f.nf_calories || 0,
        protein: f.nf_protein || 0,
        carbs: f.nf_total_carbohydrate || 0,
        fat: f.nf_total_fat || 0,
      }));
    } catch (e) {
      console.error(e);
      toast('Nutritionix search failed — check API keys. Falling back to offline list.');
      UI.foodResults = searchFallbackDb(query);
    }
    UI.foodSearchLoading = false;
    render();
  } else {
    UI.foodResults = searchFallbackDb(query);
    render();
  }
}

function searchFallbackDb(query) {
  const q = query.toLowerCase();
  return FOOD_FALLBACK_DB.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
}

function addFoodEntry(index) {
  const f = UI.foodResults[index];
  if (!f) return;
  const date = UI.foodDate;
  if (!STATE.foodLog[date]) STATE.foodLog[date] = [];
  STATE.foodLog[date].push({ ...f, qty: 1 });
  UI.foodQuery = '';
  UI.foodResults = [];
  persist(); render();
  toast('Added to log');
}

function removeFoodEntry(index) {
  STATE.foodLog[UI.foodDate].splice(index, 1);
  persist(); render();
}
