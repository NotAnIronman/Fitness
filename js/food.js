/* ============================================================
   FOOD TRACKING VIEW
   Uses the free USDA FoodData Central API (no pricing tiers).
   Works out of the box with USDA's public "DEMO_KEY" (light rate
   limits); people can add their own free key in Themes for higher
   limits. Falls back to a small offline list if the network fails.
   ============================================================ */

const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

function renderFood() {
  const date = UI.foodDate;
  const entries = STATE.foodLog[date] || [];
  const effTdee = getEffectiveTDEE();
  const goalAdjustedTarget = getFoodTargetCalories();

  const totals = entries.reduce((acc, e) => {
    acc.kcal += e.kcal * e.qty;
    acc.protein += e.protein * e.qty;
    acc.carbs += e.carbs * e.qty;
    acc.fat += e.fat * e.qty;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  return `
    <div class="page-head">
      <p class="page-eyebrow">Nutrition</p>
      <h1 class="page-title">Food log</h1>
      <p class="page-sub">Search foods, log what you eat, and compare against your target, set relative to your goal, not just plain maintenance.</p>
    </div>

    <div class="section-note">
      The most common reason a diet stops adding up isn't the meals, it's the extras: sauces, dressings, cooking oil,
      coffee add-ins, drinks, and snacks eaten standing up. If your numbers aren't matching your results, that's usually
      the first place to look. Use "+ Custom food" below to log anything the search can't find.
    </div>

    <div class="field" style="max-width:260px; margin-bottom:16px;">
      <label>Date</label>
      <input type="date" data-focus-id="food-date" value="${date}" oninput="setFoodDate(this.value)">
    </div>

    <div class="grid grid-2" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-title">Log food</div>
        <div class="search-wrap">
          <input type="text" data-focus-id="food-search" placeholder="Search foods (e.g. chicken breast)" value="${escapeAttr(UI.foodQuery)}"
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
        ${UI.foodSearchLoading ? `<p class="hint">Searching...</p>` : ''}
        <div style="margin-top:10px;">
          <button class="btn btn-sm" onclick="toggleCustomFood()">${UI.showCustomFood ? 'Cancel custom food' : '+ Custom food'}</button>
        </div>
        ${UI.showCustomFood ? renderCustomFoodForm() : ''}
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
              <div class="pill-toggle" style="flex-shrink:0;">
                <button class="btn-sm" style="border:none;background:transparent;color:var(--text-dim);padding:4px 8px;" onclick="changeFoodQty(${i}, -1)">-</button>
                <span style="font-family:var(--font-mono); font-weight:600; padding:0 4px; min-width:20px; text-align:center; display:inline-block;">${e.qty}</span>
                <button class="btn-sm" style="border:none;background:transparent;color:var(--text-dim);padding:4px 8px;" onclick="changeFoodQty(${i}, 1)">+</button>
              </div>
              <div>
                <div class="name">${e.qty} x ${escapeAttr(e.name)}</div>
                <div class="meta">P ${Math.round(e.protein * e.qty)}g . C ${Math.round(e.carbs * e.qty)}g . F ${Math.round(e.fat * e.qty)}g</div>
              </div>
              <div class="kcal">${Math.round(e.kcal * e.qty)} kcal</div>
              <button class="icon-btn" onclick="removeFoodEntry(${i})" title="Remove entirely">x</button>
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

function renderCustomFoodForm() {
  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:14px; margin-top:10px;">
      <div class="field">
        <label>Food name</label>
        <input type="text" id="cf-name" data-focus-id="cf-name" placeholder="e.g. Homemade sauce">
      </div>
      <div class="grid grid-4">
        <div class="field"><label>kcal</label><input type="number" id="cf-kcal" data-focus-id="cf-kcal" min="0" value="0"></div>
        <div class="field"><label>Protein (g)</label><input type="number" id="cf-protein" data-focus-id="cf-protein" min="0" value="0"></div>
        <div class="field"><label>Carbs (g)</label><input type="number" id="cf-carbs" data-focus-id="cf-carbs" min="0" value="0"></div>
        <div class="field"><label>Fat (g)</label><input type="number" id="cf-fat" data-focus-id="cf-fat" min="0" value="0"></div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="submitCustomFood()">Add to log</button>
    </div>
  `;
}

function renderMacroBar(label, grams, color) {
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
    return `<div class="badge badge-ok">On target</div><p class="hint" style="margin-top:8px;">You're within 5% of your target, nice consistency.</p>`;
  }
  if (diff > 0) {
    return `<div class="badge badge-warn">${Math.round(diff)} kcal over</div><p class="hint" style="margin-top:8px;">You're running above target today. Double check for hidden extras (dressings, drinks, snacks) before assuming it's the meals themselves.</p>`;
  }
  return `<div class="badge badge-ok">${Math.round(Math.abs(diff))} kcal under</div><p class="hint" style="margin-top:8px;">You're under target, good if that matches your goal, but don't drop too far below your BMR consistently.</p>`;
}

function getFoodTargetCalories() {
  const effTdee = getEffectiveTDEE();
  if (!effTdee) return null;
  const g = STATE.goal;
  if (g.targetWeightKg != null && g.targetDate) {
    const evalResult = evaluateGoal({
      startWeightKg: g.startWeightKg ?? currentWeightKg(),
      targetWeightKg: g.targetWeightKg,
      startDate: g.startDate ?? todayISO(),
      targetDate: g.targetDate,
      tdee: effTdee,
    });
    if (evalResult && !evalResult.error && evalResult.suggestedIntake) return evalResult.suggestedIntake;
  }
  return effTdee;
}

function setFoodDate(date) {
  UI.foodDate = date;
  UI.foodResults = [];
  render();
}

function toggleCustomFood() {
  UI.showCustomFood = !UI.showCustomFood;
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
  UI.foodSearchLoading = true;
  render();
  try {
    const apiKey = STATE.foodApiKey || 'DEMO_KEY';
    const url = `${USDA_SEARCH_URL}?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&pageSize=10&dataType=Branded,Foundation,SR%20Legacy`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('USDA request failed: ' + res.status);
    const data = await res.json();
    const results = (data.foods || []).map(parseUsdaFood).filter(Boolean);
    UI.foodResults = results.length ? results : searchFallbackDb(query);
  } catch (e) {
    console.error(e);
    if (STATE.foodApiKey) toast('USDA search failed, check your API key in Themes. Using offline list.');
    UI.foodResults = searchFallbackDb(query);
  }
  UI.foodSearchLoading = false;
  render();
}

function parseUsdaFood(food) {
  const name = food.brandName ? `${food.description} (${food.brandName})` : food.description;
  // Branded foods carry a simple labelNutrients object; other datasets use a
  // foodNutrients array keyed by USDA nutrient number.
  if (food.labelNutrients) {
    const ln = food.labelNutrients;
    return {
      name: `${name}${food.servingSize ? ` (${food.servingSize}${food.servingSizeUnit || ''})` : ''}`,
      kcal: ln.calories?.value || 0,
      protein: ln.protein?.value || 0,
      carbs: ln.carbohydrates?.value || 0,
      fat: ln.fat?.value || 0,
    };
  }
  const nutrients = food.foodNutrients || [];
  const find = num => {
    const n = nutrients.find(x => String(x.nutrientNumber) === num);
    return n ? (n.value || 0) : 0;
  };
  return {
    name: `${name} (100g)`,
    kcal: find('208'),
    protein: find('203'),
    carbs: find('205'),
    fat: find('204'),
  };
}

function searchFallbackDb(query) {
  const q = query.toLowerCase();
  return FOOD_FALLBACK_DB.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
}

function addFoodEntry(index) {
  const f = UI.foodResults[index];
  if (!f) return;
  addOrIncrementFood(f);
  UI.foodQuery = '';
  UI.foodResults = [];
  persist(); render();
  toast('Added to log');
}

function submitCustomFood() {
  const name = document.getElementById('cf-name').value.trim();
  if (!name) { toast('Give the food a name first'); return; }
  const f = {
    name,
    kcal: Number(document.getElementById('cf-kcal').value) || 0,
    protein: Number(document.getElementById('cf-protein').value) || 0,
    carbs: Number(document.getElementById('cf-carbs').value) || 0,
    fat: Number(document.getElementById('cf-fat').value) || 0,
  };
  addOrIncrementFood(f);
  UI.showCustomFood = false;
  persist(); render();
  toast('Added to log');
}

// Groups repeat entries of the same food into a quantity instead of duplicate rows
// (e.g. logging an apple 15 times shows as "15 x Apple", not 15 separate lines).
function addOrIncrementFood(f) {
  const date = UI.foodDate;
  if (!STATE.foodLog[date]) STATE.foodLog[date] = [];
  const existing = STATE.foodLog[date].find(e => e.name === f.name && e.kcal === f.kcal);
  if (existing) {
    existing.qty += 1;
  } else {
    STATE.foodLog[date].push({ ...f, qty: 1 });
  }
}

function changeFoodQty(index, delta) {
  const entry = STATE.foodLog[UI.foodDate][index];
  if (!entry) return;
  entry.qty = Math.max(1, entry.qty + delta);
  persist(); render();
}

function removeFoodEntry(index) {
  STATE.foodLog[UI.foodDate].splice(index, 1);
  persist(); render();
}
