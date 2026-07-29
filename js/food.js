/* ============================================================
   FOOD TRACKING VIEW
   Uses the free USDA FoodData Central API (no pricing tiers).
   Works out of the box with USDA's public "DEMO_KEY" (light rate
   limits); people can add their own free key in Themes for higher
   limits. Falls back to a small offline list if the network fails.

   Serving-size model: the adjust-before-add form always shows the
   TOTAL for however many servings you pick (base x qty), and that
   scaling happens automatically whenever you change the serving
   count, before you touch anything by hand. Once you confirm, the
   logged entry's kcal/macros ARE that total, qty resets to 1, so
   there is never a silent double-multiplication later. The +/- qty
   stepper on an already-logged row is a separate, simple "log
   another one of these" multiplier on top of that confirmed total.
   ============================================================ */

const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

function renderFood() {
  const date = UI.foodDate;
  const entries = STATE.foodLog[date] || [];
  const goalAdjustedTarget = getFoodTargetCalories();
  const compliance = getFoodComplianceCheck();

  const totals = entries.reduce((acc, e) => {
    acc.kcal += e.kcal * e.qty;
    acc.protein += e.protein * e.qty;
    acc.carbs += e.carbs * e.qty;
    acc.fat += e.fat * e.qty;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const safety = checkIntakeSafety(totals.kcal, STATE.profile.sex);

  return `
    <div class="page-head">
      <p class="page-eyebrow">Nutrition</p>
      <h1 class="page-title">Food log</h1>
      <p class="page-sub">Search for and log things you've eaten.</p>
    </div>

    ${notice('food-hidden-cals', `The most common reason a diet stops adding up isn't the meals, it's the extras: sauces, dressings, cooking oil, coffee add-ins, drinks, and snacks eaten standing up. If your numbers aren't matching your results, that's usually the first place to look.`)}

    ${notice('food-no-scale', renderPortionGuideBody())}

    ${compliance && compliance.status !== 'good' ? `
      <div class="card">
        <div class="card-title">Last ${compliance.sampleDays} days vs. target <span class="badge ${compliance.status === 'way-off' ? 'badge-danger' : 'badge-warn'}">${compliance.status === 'way-off' ? 'Big gap' : 'Slightly off'}</span></div>
        <p class="hint" style="font-size:13px;">${compliance.message}</p>
      </div>
    ` : ''}

    <div class="field" style="max-width:260px; margin-bottom:16px;">
      <label>Date</label>
      <input type="date" data-focus-id="food-date" value="${date}" onchange="setFoodDate(this.value)">
    </div>

    <div class="grid grid-2" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-title">
          Log food
          <button class="btn btn-sm" onclick="openMealBuilder()">+ Build a meal</button>
        </div>

        ${(STATE.recentFoods.length || STATE.savedMeals.length) && !UI.foodAdjustDraft && !UI.mealBuilderOpen ? `
          ${STATE.recentFoods.length ? `
            <p class="hint" style="margin-bottom:6px;">Recent:</p>
            <div class="chip-row" style="margin-bottom:12px;">
              ${STATE.recentFoods.map((f, i) => `<button class="chip" onclick="openFoodAdjustFromRecent(${i})">${escapeAttr(f.name)}</button>`).join('')}
            </div>
          ` : ''}
          ${STATE.savedMeals.length ? `
            <p class="hint" style="margin-bottom:6px;">Saved meals:</p>
            <div class="chip-row" style="margin-bottom:12px;">
              ${STATE.savedMeals.map(m => `<button class="chip" onclick="openFoodAdjustFromMeal('${m.id}')">${escapeAttr(m.name)}</button>`).join('')}
            </div>
          ` : ''}
        ` : ''}

        ${UI.mealBuilderOpen ? renderMealBuilder() : `
          <div class="search-wrap">
            <input type="text" data-focus-id="food-search" placeholder="Search foods (e.g. chicken breast)" value="${escapeAttr(UI.foodQuery)}"
              oninput="onFoodSearchInput(this.value)">
            ${UI.foodResults.length ? `
              <div class="food-search-results">
                ${UI.foodResults.map((f, i) => `
                  <div class="food-search-item" style="cursor:pointer; display:flex; justify-content:space-between;" onclick="openFoodAdjust(${i})">
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
          ${UI.foodAdjustDraft ? renderFoodAdjustForm() : ''}
        `}
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
          ${safety ? renderSafetyWarning(safety, totals.kcal) : renderFoodFeedback(totals.kcal, goalAdjustedTarget)}
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
                <div class="name">${formatQty(e.qty)} x ${escapeAttr(e.name)}</div>
                <div class="meta">P ${Math.round(e.protein * e.qty)}g . C ${Math.round(e.carbs * e.qty)}g . F ${Math.round(e.fat * e.qty)}g</div>
                <div class="chip-row" style="margin-top:6px;">
                  ${[0.5, 1, 1.5, 2].map(q => `<button class="chip ${e.qty === q ? 'active' : ''}" onclick="setFoodQty(${i}, ${q})">${formatQty(q)}x</button>`).join('')}
                  <input type="number" data-focus-id="qty-${i}" step="0.25" min="0.25" value="${e.qty}" oninput="setFoodQty(${i}, this.value)" style="width:70px; display:inline-block;">
                </div>
              </div>
              <div class="kcal">${Math.round(e.kcal * e.qty)} kcal</div>
              <button class="icon-btn" onclick="openFoodEdit(${i})" title="Edit">✎</button>
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

function renderPortionGuideBody() {
  return `
    New to tracking and don't own a food scale? You don't need one to get started. Use your hand as a rough
    guide: a palm-sized portion of protein, a cupped handful of carbs, a thumb-sized amount of fats, and a
    fist-sized portion of vegetables is a reasonable estimate for one meal. It won't be perfect, but a consistent
    rough estimate logged every day beats a perfect number logged once. You can always switch to weighing food
    later once the habit sticks.
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

// The adjust-before-adding / editing form. UI.foodAdjustDraft = { name, base:
// {kcal,protein,carbs,fat} (immutable snapshot), qty, kcal, protein, carbs, fat
// (currently shown, editable, = base*qty until hand-edited) }.
function renderFoodAdjustForm() {
  const d = UI.foodAdjustDraft;
  const isEdit = UI.editingFoodIndex != null;
  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:14px; margin-top:10px;">
      <p class="hint" style="margin-bottom:10px;"><strong style="color:var(--text)">${escapeAttr(d.name)}</strong>${isEdit ? ' (editing)' : ''}. Pick a serving size, the numbers below update to match automatically, then correct anything that doesn't match your package.</p>
      <div class="field">
        <label>Servings</label>
        <input type="number" id="fa-qty" data-focus-id="fa-qty" step="0.25" min="0.25" value="${d.qty}" oninput="onAdjustQtyInput(this.value)">
        <div class="chip-row">
          ${[0.25, 0.5, 1, 1.5, 2, 3].map(q => `<button class="chip ${d.qty === q ? 'active' : ''}" onclick="setAdjustQty(${q})">${formatQty(q)}x</button>`).join('')}
        </div>
      </div>
      <div class="grid grid-4">
        <div class="field"><label>kcal (total for servings above)</label><input type="number" id="fa-kcal" data-focus-id="fa-kcal" min="0" value="${round1(d.kcal)}"></div>
        <div class="field"><label>Protein (g)</label><input type="number" id="fa-protein" data-focus-id="fa-protein" min="0" value="${round1(d.protein)}"></div>
        <div class="field"><label>Carbs (g)</label><input type="number" id="fa-carbs" data-focus-id="fa-carbs" min="0" value="${round1(d.carbs)}"></div>
        <div class="field"><label>Fat (g)</label><input type="number" id="fa-fat" data-focus-id="fa-fat" min="0" value="${round1(d.fat)}"></div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary btn-sm" onclick="confirmFoodAdjust()">${isEdit ? 'Save changes' : 'Add to log'}</button>
        <button class="btn btn-ghost btn-sm" onclick="cancelFoodAdjust()">Cancel</button>
      </div>
    </div>
  `;
}

function round1(n) { return Math.round(n * 10) / 10; }

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

function renderSafetyWarning(safety, loggedKcal) {
  return `
    <div class="badge badge-danger">Very low intake</div>
    <p class="hint" style="margin-top:8px; line-height:1.6;">
      ${Math.round(loggedKcal)} kcal logged is well under the roughly ${safety.floor} kcal/day general floor for unsupervised
      eating. ${safety.severe ? 'This is low enough that it isn\u2019t healthy to sustain, regardless of weight goals, unless you\u2019re intentionally fasting or under a doctor\u2019s supervision.' : 'A day like this occasionally is normal (illness, fasting, a busy day), but if this is a regular pattern, it\u2019s worth talking to a doctor rather than pushing further.'}
      If this doesn't reflect what you actually ate, double check you haven't missed logging something.
    </p>
  `;
}

function renderFoodFeedback(logged, target) {
  const diff = logged - target;
  if (Math.abs(diff) < target * 0.05) {
    return `<div class="badge badge-ok">On target</div><p class="hint" style="margin-top:8px;">You're within 5% of your target, nice consistency.</p>`;
  }
  if (diff > 0) {
    return `<div class="badge badge-warn">${Math.round(diff)} kcal over</div><p class="hint" style="margin-top:8px;">You're running above target today. Check for hidden extras (dressings, drinks, snacks) before assuming it's the meals themselves.</p>`;
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

function formatQty(q) {
  const n = Number(q);
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
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

// ---------- USDA search, with a persistent local cache so repeated/similar
// searches don't re-hit the API every time (we can't realistically download
// USDA's entire multi-million-item database client-side, so this caches what's
// actually been searched instead, which covers the common case of re-searching
// the same handful of foods). ----------
let _foodSearchTimer = null;
function onFoodSearchInput(val) {
  UI.foodQuery = val;
  clearTimeout(_foodSearchTimer);
  if (!val || val.trim().length < 3) {
    UI.foodResults = [];
    renderSoon();
    return;
  }
  _foodSearchTimer = setTimeout(() => runFoodSearch(val), 400);
}

async function runFoodSearch(query) {
  const cacheKey = query.trim().toLowerCase();
  const cached = STATE.usdaCache[cacheKey];
  if (cached) {
    UI.foodResults = cached.results;
    render();
    return;
  }

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
    if (results.length) {
      STATE.usdaCache[cacheKey] = { results, ts: Date.now() };
      persist();
    }
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

// ---------- Adjust-before-adding / editing flow ----------

function openFoodAdjust(index) {
  const f = UI.foodResults[index];
  if (!f) return;
  startFoodAdjustDraft(f);
  UI.foodResults = [];
  UI.foodQuery = '';
  render();
}
function openFoodAdjustFromRecent(index) {
  const f = STATE.recentFoods[index];
  if (!f) return;
  startFoodAdjustDraft(f);
  render();
}
function openFoodAdjustFromMeal(mealId) {
  const meal = STATE.savedMeals.find(m => m.id === mealId);
  if (!meal) return;
  startFoodAdjustDraft(meal);
  render();
}
function openFoodEdit(index) {
  const entry = STATE.foodLog[UI.foodDate][index];
  if (!entry) return;
  UI.editingFoodIndex = index;
  UI.foodAdjustDraft = {
    name: entry.name,
    base: { kcal: entry.kcal, protein: entry.protein, carbs: entry.carbs, fat: entry.fat },
    qty: entry.qty,
    kcal: entry.kcal * entry.qty,
    protein: entry.protein * entry.qty,
    carbs: entry.carbs * entry.qty,
    fat: entry.fat * entry.qty,
  };
  render();
}

function startFoodAdjustDraft(f) {
  UI.editingFoodIndex = null;
  UI.foodAdjustDraft = {
    name: f.name,
    base: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat },
    qty: 1,
    kcal: f.kcal,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
  };
}

// Rescales the shown macro fields from the immutable base whenever the serving
// count changes, before any manual correction, this is the fix for servings not
// live-updating the macros.
function rescaleAdjustDraft(qty) {
  const d = UI.foodAdjustDraft;
  d.qty = qty;
  d.kcal = d.base.kcal * qty;
  d.protein = d.base.protein * qty;
  d.carbs = d.base.carbs * qty;
  d.fat = d.base.fat * qty;
}
function setAdjustQty(q) {
  rescaleAdjustDraft(q);
  render();
}
function onAdjustQtyInput(val) {
  const q = Number(val) || 0.25;
  rescaleAdjustDraft(q);
  renderSoon();
}

function confirmFoodAdjust() {
  const d = UI.foodAdjustDraft;
  const isEdit = UI.editingFoodIndex != null;
  const f = {
    name: d.name,
    kcal: Number(document.getElementById('fa-kcal').value) || 0,
    protein: Number(document.getElementById('fa-protein').value) || 0,
    carbs: Number(document.getElementById('fa-carbs').value) || 0,
    fat: Number(document.getElementById('fa-fat').value) || 0,
  };
  const qty = 1; // scaling is already baked into the numbers above

  if (isEdit) {
    STATE.foodLog[UI.foodDate][UI.editingFoodIndex] = { ...f, qty };
  } else {
    addOrIncrementFood(f, qty);
  }
  recordRecentFood(f);
  UI.foodAdjustDraft = null;
  UI.editingFoodIndex = null;
  persist(); render();
  toast(isEdit ? 'Updated' : 'Added to log');
}
function cancelFoodAdjust() {
  UI.foodAdjustDraft = null;
  UI.editingFoodIndex = null;
  render();
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
  addOrIncrementFood(f, 1);
  recordRecentFood(f);
  UI.showCustomFood = false;
  persist(); render();
  toast('Added to log');
}

// Groups repeat entries of the exact same food (matched on name + kcal) into one
// line with a quantity instead of duplicate rows, e.g. "3 x Apple".
function addOrIncrementFood(f, qty) {
  const date = UI.foodDate;
  if (!STATE.foodLog[date]) STATE.foodLog[date] = [];
  const existing = STATE.foodLog[date].find(e => e.name === f.name && e.kcal === f.kcal);
  if (existing) {
    existing.qty += qty;
  } else {
    STATE.foodLog[date].push({ ...f, qty });
  }
}

function setFoodQty(index, value) {
  const entry = STATE.foodLog[UI.foodDate][index];
  if (!entry) return;
  const n = Number(value);
  entry.qty = n > 0 ? n : 0.25;
  persist(); renderSoon();
}

function removeFoodEntry(index) {
  STATE.foodLog[UI.foodDate].splice(index, 1);
  persist(); render();
}

// ============================================================
// MEAL BUILDER
// Combine several food items (e.g. spaghetti = noodles + sauce + bread) into
// one saved, editable, loggable item.
// ============================================================

function renderMealBuilder() {
  const items = UI.mealBuilderItems;
  const totals = items.reduce((acc, it) => {
    acc.kcal += it.kcal * it.qty; acc.protein += it.protein * it.qty;
    acc.carbs += it.carbs * it.qty; acc.fat += it.fat * it.qty;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:14px;">
      <div class="field">
        <label>Meal name</label>
        <input type="text" id="mb-name" data-focus-id="mb-name" placeholder="e.g. Spaghetti night" value="${escapeAttr(UI.mealBuilderName)}" oninput="onMealNameInput(this.value)">
      </div>

      <p class="hint" style="margin-bottom:6px;">Add items:</p>
      <div class="search-wrap" style="margin-bottom:12px;">
        <input type="text" data-focus-id="meal-search" placeholder="Search foods to add" value="${escapeAttr(UI.foodQuery)}" oninput="onFoodSearchInput(this.value)">
        ${UI.foodResults.length ? `
          <div class="food-search-results">
            ${UI.foodResults.map((f, i) => `
              <div class="food-search-item" style="cursor:pointer; display:flex; justify-content:space-between;" onclick="addItemToMeal(${i})">
                <span>${escapeAttr(f.name)}</span>
                <span style="color:var(--text-dim); font-family:var(--font-mono); font-size:12px;">${Math.round(f.kcal)} kcal</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      ${UI.foodSearchLoading ? `<p class="hint">Searching...</p>` : ''}

      ${items.length ? `
        <div class="row-list" style="margin-bottom:12px;">
          ${items.map((it, i) => `
            <div class="exercise-row">
              <div>
                <div class="name">${escapeAttr(it.name)}</div>
                <div class="meta">P ${Math.round(it.protein * it.qty)}g . C ${Math.round(it.carbs * it.qty)}g . F ${Math.round(it.fat * it.qty)}g</div>
              </div>
              <input type="number" step="0.25" min="0.25" value="${it.qty}" oninput="setMealItemQty(${i}, this.value)" style="width:60px;">
              <div class="kcal">${Math.round(it.kcal * it.qty)} kcal</div>
              <button class="icon-btn" onclick="removeMealItem(${i})">x</button>
            </div>
          `).join('')}
        </div>
        <div class="grid grid-4" style="margin-bottom:12px;">
          <div class="stat"><div class="stat-label">Total</div><div class="stat-value" style="font-size:18px;">${Math.round(totals.kcal)}<span class="unit">kcal</span></div></div>
          <div class="stat"><div class="stat-label">Protein</div><div class="stat-value" style="font-size:18px;">${Math.round(totals.protein)}g</div></div>
          <div class="stat"><div class="stat-label">Carbs</div><div class="stat-value" style="font-size:18px;">${Math.round(totals.carbs)}g</div></div>
          <div class="stat"><div class="stat-label">Fat</div><div class="stat-value" style="font-size:18px;">${Math.round(totals.fat)}g</div></div>
        </div>
      ` : `<div class="empty-state">No items added yet.</div>`}

      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary btn-sm" onclick="saveMeal()">Save meal</button>
        <button class="btn btn-ghost btn-sm" onclick="closeMealBuilder()">Cancel</button>
      </div>
    </div>
  `;
}

function openMealBuilder() {
  UI.mealBuilderOpen = true;
  UI.mealBuilderName = '';
  UI.mealBuilderItems = [];
  UI.foodResults = [];
  UI.foodQuery = '';
  render();
}
function closeMealBuilder() {
  UI.mealBuilderOpen = false;
  UI.foodResults = [];
  UI.foodQuery = '';
  render();
}
function onMealNameInput(val) {
  UI.mealBuilderName = val;
  renderSoon();
}
function addItemToMeal(index) {
  const f = UI.foodResults[index];
  if (!f) return;
  UI.mealBuilderItems.push({ ...f, qty: 1 });
  UI.foodResults = [];
  UI.foodQuery = '';
  render();
}
function setMealItemQty(index, val) {
  const n = Number(val);
  UI.mealBuilderItems[index].qty = n > 0 ? n : 0.25;
  renderSoon();
}
function removeMealItem(index) {
  UI.mealBuilderItems.splice(index, 1);
  render();
}
function saveMeal() {
  if (!UI.mealBuilderItems.length) { toast('Add at least one item first'); return; }
  const name = (UI.mealBuilderName || '').trim() || 'Saved meal';
  const totals = UI.mealBuilderItems.reduce((acc, it) => {
    acc.kcal += it.kcal * it.qty; acc.protein += it.protein * it.qty;
    acc.carbs += it.carbs * it.qty; acc.fat += it.fat * it.qty;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  STATE.savedMeals.push({
    id: uid(),
    name,
    items: UI.mealBuilderItems.map(it => ({ ...it })),
    kcal: totals.kcal, protein: totals.protein, carbs: totals.carbs, fat: totals.fat,
  });
  UI.mealBuilderOpen = false;
  persist(); render();
  toast(`Saved "${name}"`);
}
