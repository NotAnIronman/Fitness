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

const MACRO_FIT_META = {
  good: { label: 'Strong contribution', className: 'macro-fit-good' },
  mixed: { label: 'Useful contribution', className: 'macro-fit-mixed' },
  low: { label: 'Limited contribution', className: 'macro-fit-low' },
  neutral: { label: 'Not scored', className: 'macro-fit-neutral' },
};

function macroPlanShares() {
  const guidance = getGoalGuidance();
  const macroPlan = getGoalMacroPlan(getFoodTargetCalories());
  if (!macroPlan || !guidance.proteinLowGrams) return null;
  const protein = (guidance.proteinLowGrams + guidance.proteinHighGrams) / 2 * 4;
  const carbs = macroPlan.carbEstimateGrams * 4;
  const fat = (macroPlan.fatLowGrams + macroPlan.fatHighGrams) / 2 * 9;
  const total = protein + carbs + fat;
  return total > 0 ? { protein: protein / total, carbs: carbs / total, fat: fat / total } : null;
}

function macroSharesFromGrams(protein, carbs, fat) {
  const energy = { protein: Math.max(0, Number(protein) || 0) * 4, carbs: Math.max(0, Number(carbs) || 0) * 4, fat: Math.max(0, Number(fat) || 0) * 9 };
  const total = energy.protein + energy.carbs + energy.fat;
  return total > 0 ? { protein: energy.protein / total, carbs: energy.carbs / total, fat: energy.fat / total, energy: total } : null;
}

function getFoodMacroFit(food) {
  const guidance = getGoalGuidance();
  const calorieTarget = getFoodTargetCalories();
  const declaredKcal = Number(food.kcal) || 0;
  const macroEnergy = Math.max(0, Number(food.protein) || 0) * 4 + Math.max(0, Number(food.carbs) || 0) * 4 + Math.max(0, Number(food.fat) || 0) * 9;
  const kcal = declaredKcal >= 20 ? declaredKcal : macroEnergy;
  if (!calorieTarget || !guidance.proteinLowGrams || kcal < 20) return MACRO_FIT_META.neutral;

  // A single ingredient should not be expected to resemble a whole day's
  // protein/carb/fat ratio. Score how usefully it contributes to the harder
  // goal-specific target—usually protein—while daily totals judge balance.
  const proteinPer100Kcal = Math.max(0, Number(food.protein) || 0) / kcal * 100;
  const dailyProteinDensity = ((guidance.proteinLowGrams + guidance.proteinHighGrams) / 2) / calorieTarget * 100;
  const focusMultiplier = ['fat_loss', 'muscle_gain', 'recomposition'].includes(guidance.focus.key) ? 1 : guidance.focus.key === 'performance' ? 0.72 : 0.82;
  const strongProtein = Math.max(4.5, dailyProteinDensity * focusMultiplier);
  const fatShare = macroEnergy > 0 ? (Math.max(0, Number(food.fat) || 0) * 9) / macroEnergy : 0;
  const carbShare = macroEnergy > 0 ? (Math.max(0, Number(food.carbs) || 0) * 4) / macroEnergy : 0;

  let tier = proteinPer100Kcal >= strongProtein ? 'good'
    : proteinPer100Kcal >= strongProtein * 0.52 ? 'mixed'
    : 'low';
  // Performance-focused users can also get a useful contribution from a
  // carbohydrate-dense, lower-fat fuel even when it is not protein-rich.
  if (guidance.focus.key === 'performance' && carbShare >= 0.55 && fatShare <= 0.25) tier = 'good';
  else if (guidance.focus.key === 'performance' && carbShare >= 0.45 && fatShare <= 0.35 && tier === 'low') tier = 'mixed';
  // Very high fat share can still fit a day, but it is rarely a strong solo
  // contribution to these goals unless protein density is exceptional.
  if (fatShare > 0.65 && proteinPer100Kcal < strongProtein * 1.35 && tier === 'good') tier = 'mixed';
  return { ...MACRO_FIT_META[tier], proteinPer100Kcal, focusLabel: guidance.focus.label };
}

function renderFoodMacroName(food) {
  const fit = getFoodMacroFit(food);
  const detail = fit.proteinPer100Kcal == null ? fit.label : `${fit.label} for ${fit.focusLabel}: ${fit.proteinPer100Kcal.toFixed(1)} g protein per 100 kcal. Individual foods are scored by useful contribution; the full day is scored for balance.`;
  return `<div class="name food-macro-name ${fit.className}" title="${escapeAttr(detail)}">${formatQty(food.qty)} x ${escapeAttr(formatFoodNameForUnits(food.name))} <span class="macro-fit-text">${fit.label}</span></div>`;
}

function getDailyMacroStatuses(totals) {
  const target = getGoalMacroPlan(getFoodTargetCalories());
  const neutral = { protein: MACRO_FIT_META.neutral, carbs: MACRO_FIT_META.neutral, fat: MACRO_FIT_META.neutral };
  if (!target || Number(totals.kcal) < target.calorieTarget * 0.5) return neutral;
  const rangeStatus = (value, low, high) => {
    if (value >= low && value <= high) return MACRO_FIT_META.good;
    if (value >= low * 0.75 && value <= high * 1.25) return MACRO_FIT_META.mixed;
    return MACRO_FIT_META.low;
  };
  return {
    protein: rangeStatus(totals.protein, target.proteinLowGrams, target.proteinHighGrams * 1.1),
    carbs: rangeStatus(totals.carbs, target.carbEstimateGrams * 0.75, target.carbEstimateGrams * 1.25),
    fat: rangeStatus(totals.fat, target.fatLowGrams, target.fatHighGrams),
  };
}

function renderFood() {
  const date = UI.foodDate;
  const entries = STATE.foodLog[date] || [];
  const targetContext = getFoodTargetContext();
  const goalAdjustedTarget = targetContext.target;
  const compliance = getFoodComplianceCheck();

  const totals = entries.reduce((acc, e) => {
    acc.kcal += e.kcal * e.qty;
    acc.protein += e.protein * e.qty;
    acc.carbs += e.carbs * e.qty;
    acc.fat += e.fat * e.qty;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const safety = checkIntakeSafety(totals.kcal, STATE.profile.sex);
  const macroStatuses = getDailyMacroStatuses(totals);
  const goalTimelineCollapsed = STATE.uiPrefs.foodGoalTimelineCollapsed;

  return `
    <div class="page-head">
      <p class="page-eyebrow">Nutrition</p>
      <h1 class="page-title">Food log</h1>
      <p class="page-sub">Search for and log things you've eaten.</p>
    </div>

    <div class="date-nav-row" style="max-width:400px;">
      ${renderDatePrevButton('shiftFoodDate')}
      <div class="field date-nav-bar" style="margin-bottom:0;">
        <label>Date</label>
        <input type="date" data-focus-id="food-date" value="${date}" onchange="setFoodDate(this.value)">
      </div>
      ${renderDateNextButton('shiftFoodDate')}
    </div>

    ${notice('food-hidden-cals', `The most common reason a diet stops adding up isn't the meals, it's the extras: sauces, dressings, cooking oil, coffee add-ins, drinks, and snacks eaten standing up. If your numbers aren't matching your results, that's usually the first place to look.`, { maxLevel: 2, defaultOpenThrough: 1, brief: `If intake and results do not match, first check easy-to-miss extras such as oils, sauces, drinks, and snacks.` })}

    ${notice('food-pet-reward', `Your pet earns a meal once your day's total logged calories pass ${STATE.profile.sex === 'male' ? MIN_SAFE_INTAKE.male : MIN_SAFE_INTAKE.female} kcal, not once per item logged, so it rewards actually eating enough for the day rather than logging lots of tiny entries.`, { maxLevel: 0, defaultOpenThrough: 0 })}

    ${notice('food-no-scale', renderPortionGuideBody(), { maxLevel: 1, defaultOpenThrough: 0 })}

    ${compliance && compliance.status !== 'good' ? `
      <div class="card">
        <div class="card-title">Last ${compliance.sampleDays} days vs. target <span class="badge ${compliance.status === 'way-off' ? 'badge-danger' : 'badge-warn'}">${compliance.status === 'way-off' ? 'Big gap' : 'Slightly off'}</span></div>
        <p class="hint" style="font-size:13px;">${compliance.message}</p>
      </div>
    ` : ''}

    ${targetContext.warning ? `<div class="card${goalTimelineCollapsed ? ' panel-card-collapsed' : ''}"><div class="card-title"><span>Goal timeline needs adjustment</span><span class="badge badge-warn">Maintenance shown</span><button class="panel-collapse-btn" onclick="toggleRememberedPanel('foodGoalTimelineCollapsed')" aria-expanded="${!goalTimelineCollapsed}" aria-label="${goalTimelineCollapsed ? 'Expand' : 'Minimize'} goal timeline warning">${goalTimelineCollapsed ? '+' : '−'}</button></div>${goalTimelineCollapsed ? '' : `<p class="hint">${escapeAttr(targetContext.warning)}</p>`}</div>` : ''}

    ${renderWaterCard(date)}

    <div class="grid grid-2" style="margin-bottom:16px;">
      <div class="card ${['food_log','meal'].some(onboardingStepIs) ? 'onboarding-focus' : ''}">
        <div class="card-title">
          Log food
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm" onclick="openBarcodeScanner()">📷 Scan barcode</button>
            <button class="btn btn-sm" onclick="openMealBuilder()">+ Build a meal</button>
          </div>
        </div>

        ${UI.barcodeScannerOpen ? renderBarcodeScanner() : `
          ${(STATE.recentFoods.length || STATE.savedMeals.length) && !UI.foodAdjustDraft && !UI.mealBuilderOpen ? `
            <button class="notice-pill" onclick="toggleFoodQuickPicks()">
              <span class="plus">${UI.foodQuickPicksOpen ? '\u2212' : '+'}</span> Recent & saved (${STATE.recentFoods.length + STATE.savedMeals.length})
            </button>
            ${UI.foodQuickPicksOpen ? `
              ${STATE.recentFoods.length ? `
                <p class="hint" style="margin: 10px 0 6px;">Recent:</p>
                <div class="chip-row" style="margin-bottom:12px;">
                  ${STATE.recentFoods.map((f, i) => `<button class="chip" onclick="openFoodAdjustFromRecent(${i})">${escapeAttr(formatFoodNameForUnits(f.name))}</button>`).join('')}
                </div>
              ` : ''}
              ${STATE.savedMeals.length ? `
                <p class="hint" style="margin-bottom:6px;">Saved meals:</p>
                <div class="chip-row" style="margin-bottom:12px;">
                  ${STATE.savedMeals.map(m => `<button class="chip" onclick="openFoodAdjustFromMeal('${m.id}')">${escapeAttr(m.name)}</button>`).join('')}
                </div>
              ` : ''}
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
                      <span>${escapeAttr(formatFoodNameForUnits(f.name))}</span>
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

    ${renderGoalNutritionGuidance(totals)}

    <div class="card ${onboardingStepIs('meal') ? 'onboarding-focus' : ''}">
      <div class="card-title"><span>Logged today <span style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim);">${entries.length} item(s)</span></span>${entries.length >= 2 ? `<button class="btn btn-sm ${UI.foodCombineOpen ? 'btn-primary' : ''}" onclick="toggleFoodCombine()">${UI.foodCombineOpen ? 'Cancel grouping' : 'Combine into meal'}</button>` : ''}</div>
      ${UI.foodCombineOpen ? renderFoodCombinePanel(entries) : ''}
      ${entries.length ? `
        <div class="row-list">
          ${entries.map((e, i) => `
            <div class="exercise-row ${UI.foodCombineSelected.includes(i) ? 'food-row-selected' : ''}">
              ${UI.foodCombineOpen ? `<label class="food-combine-check"><input type="checkbox" ${UI.foodCombineSelected.includes(i) ? 'checked' : ''} onchange="toggleFoodCombineSelection(${i})"><span class="sr-only">Select ${escapeAttr(formatFoodNameForUnits(e.name))}</span></label>` : ''}
              <div>
                ${renderFoodMacroName(e)}
                <div class="meta">P ${Math.round(e.protein * e.qty)}g . C ${Math.round(e.carbs * e.qty)}g . F ${Math.round(e.fat * e.qty)}g</div>
                <div class="chip-row" style="margin-top:6px;">
                  ${[0.5, 1, 1.5, 2].map(q => `<button class="chip ${e.qty === q ? 'active' : ''}" onclick="setFoodQty(${i}, ${q})">${formatQty(q)}x</button>`).join('')}
                  <input type="number" data-focus-id="qty-${i}" step="0.25" min="0.25" value="${e.qty}" onchange="setFoodQty(${i}, this.value)" onkeydown="if(event.key==='Enter') this.blur()" style="width:70px; display:inline-block;">
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
          ${renderMacroBar('Protein', totals.protein, macroStatuses.protein)}
          ${renderMacroBar('Carbs', totals.carbs, macroStatuses.carbs)}
          ${renderMacroBar('Fat', totals.fat, macroStatuses.fat)}
        </div>
        <p class="hint macro-fit-disclaimer">Food-name colors show how strongly one item contributes toward your selected goal, primarily from protein per calorie; performance plans also recognize lower-fat carbohydrate fuel. Daily macro colors judge the combined day only after at least half the calorie target is logged. Neither is a healthfulness grade: fiber, micronutrients, sodium, saturated fat, allergies, food access, and the rest of the diet still matter.</p>
      ` : ''}
    </div>
  `;
}

function renderGoalNutritionGuidance(totals) {
  const guidance = getGoalGuidance();
  const macroPlan = getGoalMacroPlan(getFoodTargetCalories());
  if (!guidance.proteinLowGrams || !macroPlan) return '';
  const protein = Math.round(totals.protein);
  const carbs = Math.round(totals.carbs);
  const fat = Math.round(totals.fat);
  const status = getDailyMacroStatuses(totals);
  return `<div class="card goal-nutrition-card">
    <div class="card-title">${escapeAttr(guidance.focus.label)} macro plan</div>
    <div class="grid grid-3">
      <div class="stat ${status.protein.className}"><div class="stat-label">Protein · ${status.protein.label}</div><div class="stat-value" style="font-size:20px;">${protein}<span class="unit">g logged</span></div><div class="hint">Plan ${guidance.proteinLowGrams}-${guidance.proteinHighGrams} g · ${formatProteinRateRange(guidance.proteinMin, guidance.proteinMax)}</div></div>
      <div class="stat ${status.carbs.className}"><div class="stat-label">Carbohydrate · ${status.carbs.label}</div><div class="stat-value" style="font-size:20px;">${carbs}<span class="unit">g logged</span></div><div class="hint">Flexible start ~${macroPlan.carbEstimateGrams} g</div></div>
      <div class="stat ${status.fat.className}"><div class="stat-label">Fat · ${status.fat.label}</div><div class="stat-value" style="font-size:20px;">${fat}<span class="unit">g logged</span></div><div class="hint">Plan ${macroPlan.fatLowGrams}-${macroPlan.fatHighGrams} g (${macroPlan.fatMinPct}-${macroPlan.fatMaxPct}% kcal)</div></div>
    </div>
    ${(STATE.uiPrefs.knowledgeLevel || 0) >= 4 ? '' : `<p class="hint" style="margin-top:10px;">${escapeAttr(macroPlan.carbNote)} These are starting allocations, not pass/fail scores.</p>`}
  </div>`;
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
  const hasPortions = d.portions && d.portions.length > 0;
  const portionUnitLabel = hasPortions && d.selectedPortionIdx != null ? d.portions[d.selectedPortionIdx].label : `${d.portionGrams}g`;
  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:14px; margin-top:10px;">
      <p class="hint" style="margin-bottom:10px;"><strong style="color:var(--text)">${escapeAttr(formatFoodNameForUnits(d.name))}</strong>${isEdit ? ' (editing)' : ''}. Pick a serving size, the numbers below update to match automatically, then correct anything that doesn't match your package.</p>

      ${d.portionsLoading ? `<p class="hint" style="margin-bottom:10px;">Looking up real portion sizes for this food...</p>` : ''}

      ${hasPortions ? `
        <div class="field">
          <label>What's one serving?</label>
          <div class="chip-row">
            ${d.portions.map((p, i) => `<button class="chip ${d.selectedPortionIdx === i ? 'active' : ''}" onclick="selectFoodPortion(${i})">${escapeAttr(p.label)} (${p.grams}g)</button>`).join('')}
            <button class="chip ${d.selectedPortionIdx === null ? 'active' : ''}" onclick="useRawGramsForDraft()">Exact grams</button>
          </div>
          <p class="hint" style="margin-top:4px;">From USDA's own household-measure data for this food, not a guess. Pick whichever is closest, then fine-tune with the numbers below.</p>
        </div>
      ` : ''}

      <div class="field">
        <label>How many ${hasPortions ? escapeAttr(portionUnitLabel) : 'servings'}?</label>
        <input type="number" id="fa-qty" data-focus-id="fa-qty" step="0.25" min="0.25" value="${d.qty}" onchange="onAdjustQtyInput(this.value)" onkeydown="if(event.key==='Enter') this.blur()">
        <div class="chip-row">
          ${[0.25, 0.5, 1, 1.5, 2, 3].map(q => `<button class="chip ${d.qty === q ? 'active' : ''}" onclick="setAdjustQty(${q})">${formatQty(q)}x</button>`).join('')}
        </div>
      </div>
      <div class="grid grid-4">
        <div class="field"><label>kcal (total for the amount above)</label><input type="number" id="fa-kcal" data-focus-id="fa-kcal" min="0" value="${round1(d.kcal)}"></div>
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
function nonNegativeFoodNumber(id) {
  return Math.max(0, Number(document.getElementById(id)?.value) || 0);
}

function renderMacroBar(label, grams, status) {
  return `
    <div class="stat ${status.className}">
      <div class="stat-label">${label} · ${status.label}</div>
      <div class="stat-value" style="font-size:18px;">${Math.round(grams)}g</div>
    </div>
  `;
}

function renderSafetyWarning(safety, loggedKcal) {
  return `
    <div class="badge badge-danger">Very low intake</div>
    <p class="hint" style="margin-top:8px; line-height:1.6;">
      ${Math.round(loggedKcal)} kcal logged is below Forge's coarse ${safety.floor} kcal/day review threshold for unsupervised
      adult planning. ${safety.severe ? 'If this reflects repeated intake rather than an incomplete log, pause the deficit and seek individualized guidance.' : 'A single day may reflect illness, fasting, appetite changes, or incomplete tracking; a repeated pattern deserves individualized guidance rather than a more aggressive target.'}
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
  return `<div class="badge ${Math.abs(diff) > target * 0.10 ? 'badge-warn' : 'badge-ok'}">${Math.round(Math.abs(diff))} kcal under</div><p class="hint" style="margin-top:8px;">You are below today’s planning target. One day is not a trend; if this gap is frequent, check for missed items and choose a target you can sustain without persistent hunger, poor recovery, or declining performance.</p>`;
}

function getFoodTargetContext() {
  const effTdee = getEffectiveTDEE();
  if (!effTdee) return { target: null, goalApplied: false, warning: null };
  const g = STATE.goal;
  if (g.targetWeightKg != null && g.targetDate) {
    const evalResult = evaluateGoal({
      startWeightKg: g.startWeightKg ?? currentWeightKg(),
      targetWeightKg: g.targetWeightKg,
      startDate: g.startDate ?? todayISO(),
      targetDate: g.targetDate,
      tdee: effTdee,
    });
    if (evalResult && !evalResult.error) {
      if (evalResult.unsafeTarget || !evalResult.suggestedIntake) {
        return {
          target: effTdee,
          goalApplied: false,
          warning: 'The selected weight and date would require an intake Forge cannot responsibly recommend. Extend the goal date; until then, this page shows estimated maintenance calories.',
        };
      }
      return { target: evalResult.suggestedIntake, goalApplied: true, warning: null };
    }
  }
  return { target: effTdee, goalApplied: false, warning: null };
}

function getFoodTargetCalories() {
  return getFoodTargetContext().target;
}

function formatQty(q) {
  const n = Number(q);
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// ---------- Water tracking ----------
// Quick-add chips for common amounts, a target from bodyweight/sex (see
// getWaterTargetMl in calc.js), and each log grants your pet a water item on
// the Pet page tray (see js/pet.js).
function renderWaterCard(date) {
  const p = STATE.profile;
  const isImperial = p.unitSystem === 'imperial';
  const entry = STATE.dailyWater[date];
  const loggedMl = entry ? entry.ml : 0;
  const target = getWaterTargetMl(p.weightKg);
  const toDisplay = ml => isImperial ? `${(ml / 29.5735).toFixed(0)} fl oz` : `${(ml / 1000).toFixed(2)} L`;
  const pct = target ? Math.min(100, (loggedMl / target) * 100) : 0;
  const expert = (STATE.uiPrefs.knowledgeLevel || 0) >= 4;
  const hydrationRate = formatHydrationRate(33);

  return `
    <div class="card ${onboardingStepIs('water') ? 'onboarding-focus' : ''}">
      <div class="card-title">Water</div>
      ${target ? `
        <div class="grid grid-2" style="margin-bottom:10px;">
          <div class="stat"><div class="stat-label">Logged today</div><div class="stat-value" style="font-size:20px;">${toDisplay(loggedMl)}</div></div>
          <div class="stat"><div class="stat-label">Logging estimate</div><div class="stat-value accent" style="font-size:20px;">${toDisplay(target)}</div></div>
        </div>
        <div class="macro-bar-track" style="margin-bottom:12px;"><div class="macro-bar-fill" style="width:${pct}%; background:#38BDF8;"></div></div>
        <p class="hint" style="margin-bottom:10px;">${expert ? `Fluid-log estimate: ${hydrationRate}; adjust for conditions and sweat.` : `A practical fluid-logging estimate of ~${hydrationRate}, not an official requirement. <a href="https://www.nationalacademies.org/read/10925/chapter/2" target="_blank" rel="noopener noreferrer">National Academies reference values</a> cover total water from food and every beverage; individual needs vary with heat, altitude, illness, pregnancy or breastfeeding, and sweat losses. Thirst is a useful day-to-day guide. Reach this logged-fluid target and your pet earns one water item.`}</p>
        <div class="chip-row">
          ${[250, 350, 500, 750].map(ml => `<button class="chip" onclick="logWater(${ml}, '${date}')">+${toDisplay(ml)}</button>`).join('')}
          <button class="chip" onclick="undoLastWater('${date}')">Undo last</button>
        </div>
      ` : `<div class="hint">Set your weight on Home to see a body-size-based fluid-logging estimate.</div>`}
    </div>
  `;
}

function logWater(ml, date) {
  const entry = STATE.dailyWater[date] || { ml: 0 };
  entry.ml += ml;
  if (!Array.isArray(entry.events)) entry.events = [];
  entry.events.push(ml);
  STATE.dailyWater[date] = entry;
  grantPetWaterIfThresholdMet(date);
  persist(); render();
}

// Same idea as grantPetFoodIfThresholdMet: one water tray item per day, the
// first time that day's logged water reaches the personalized target (see
// getWaterTargetMl), not one per log action.
function grantPetWaterIfThresholdMet(date) {
  if (date !== todayISO()) return;
  if (STATE.pet.waterRewardedDates[date]) return;
  const entry = STATE.dailyWater[date];
  const loggedMl = entry ? entry.ml : 0;
  const target = getWaterTargetMl(STATE.profile.weightKg, STATE.profile.sex);
  if (!target || loggedMl < target) return;
  STATE.pet.waterInventory = (STATE.pet.waterInventory || 0) + 1;
  STATE.pet.waterRewardedDates[date] = true;
  if (typeof markPetInteraction === 'function') markPetInteraction(2);
  toast(`Hit your water target today, ${STATE.pet.name || 'your pet'} earned a drink!`);
}

function undoLastWater(date) {
  const entry = STATE.dailyWater[date];
  if (!entry || entry.ml <= 0) return;
  const lastAmount = Array.isArray(entry.events) && entry.events.length ? entry.events.pop() : 250;
  entry.ml = Math.max(0, entry.ml - lastAmount);
  persist(); render();
}

function setFoodDate(date) {
  if (!isReasonableDateString(date)) { toast("That doesn't look like a valid date, try again"); render(); return; }
  UI.foodDate = date;
  UI.foodResults = [];
  closeFoodCombine(false);
  render();
}

function toggleFoodQuickPicks() {
  UI.foodQuickPicksOpen = !UI.foodQuickPicksOpen;
  render();
}

function shiftFoodDate(delta) {
  const d = new Date(UI.foodDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  setFoodDate(dateToLocalISO(d));
}

function toggleCustomFood() {
  UI.showCustomFood = !UI.showCustomFood;
  render();
}

// ---------- USDA search ----------
// Two layers of caching so repeated/similar searches stop hitting USDA's rate
// limit: an exact-query cache (usdaCache), and a growing local pool of every
// food item ever returned (foodIndexPool). New searches check the pool via
// substring match FIRST; only if it doesn't have enough matches does this fall
// through to the network. Every successful network search adds its results to
// the pool, so the more the app gets used, the more searches get answered
// entirely locally over time.
const POOL_MATCH_THRESHOLD = 5; // if the local pool already has this many matches, skip the network entirely
let _foodSearchTimer = null;
function onFoodSearchInput(val) {
  UI.foodQuery = val;
  clearTimeout(_foodSearchTimer);
  if (!val || val.trim().length < 3) {
    UI.foodResults = [];
    renderSoon();
    return;
  }
  _foodSearchTimer = setTimeout(() => runFoodSearch(val), 550);
}

function searchLocalPool(query) {
  const q = query.trim().toLowerCase();
  const fromPool = STATE.foodIndexPool.filter(f => f.name.toLowerCase().includes(q));
  const fromFallback = FOOD_FALLBACK_DB.filter(f => f.name.toLowerCase().includes(q));
  // de-dupe by name, pool first since it's more likely to match what was actually searched before
  const seen = new Set();
  const combined = [];
  [...fromPool, ...fromFallback].forEach(f => {
    if (!seen.has(f.name)) { seen.add(f.name); combined.push(f); }
  });
  return combined;
}

function mergeIntoFoodIndexPool(results) {
  const existingNames = new Set(STATE.foodIndexPool.map(f => f.name));
  let added = 0;
  results.forEach(f => {
    if (!existingNames.has(f.name)) {
      STATE.foodIndexPool.push(f);
      existingNames.add(f.name);
      added++;
    }
  });
  // cap so this doesn't grow forever - keep the most recently seen items
  if (STATE.foodIndexPool.length > 600) {
    STATE.foodIndexPool = STATE.foodIndexPool.slice(-600);
  }
  return added;
}

async function runFoodSearch(query) {
  const cacheKey = query.trim().toLowerCase();

  // Layer 1: exact repeat of a query we've already made.
  const cached = STATE.usdaCache[cacheKey];
  if (cached) {
    UI.foodResults = cached.results;
    render();
    return;
  }

  // Layer 2: the growing local pool, answered instantly with no network call.
  const poolMatches = searchLocalPool(query);
  if (poolMatches.length >= POOL_MATCH_THRESHOLD) {
    UI.foodResults = poolMatches.slice(0, 10);
    render();
    return;
  }

  // Layer 3: network, only when the local pool doesn't have enough yet.
  UI.foodSearchLoading = true;
  render();
  try {
    const apiKey = STATE.foodApiKey || 'DEMO_KEY';
    const url = `${USDA_SEARCH_URL}?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&pageSize=10&dataType=Branded,Foundation,SR%20Legacy`;
    const res = await fetch(url);
    if (res.status === 429 || res.status === 403) {
      throw new Error('rate-limited');
    }
    if (!res.ok) throw new Error('USDA request failed: ' + res.status);
    const data = await res.json();
    const results = (data.foods || []).map(parseUsdaFood).filter(Boolean);
    if (results.length) {
      mergeIntoFoodIndexPool(results);
      STATE.usdaCache[cacheKey] = { results, ts: Date.now() };
      persist();
      UI.foodResults = results;
    } else {
      UI.foodResults = poolMatches.length ? poolMatches : searchFallbackDb(query);
    }
  } catch (e) {
    console.error(e);
    if (e.message === 'rate-limited') {
      toast(STATE.foodApiKey
        ? "USDA's rate limit was hit, showing what's cached locally instead."
        : "USDA's shared demo key hit its rate limit, add your own free key in Themes for higher limits. Showing what's cached locally.");
    } else if (STATE.foodApiKey) {
      toast('USDA search failed, check your API key in Themes. Using local results.');
    }
    UI.foodResults = poolMatches.length ? poolMatches : searchFallbackDb(query);
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
      fdcId: food.fdcId,
      perServing: true, // already the real labeled serving, not per-100g
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
    fdcId: food.fdcId,
    perServing: false, // per-100g raw value, real portions fetched lazily when adjusting (see fetchUsdaPortions)
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
    rawPer100g: null, // editing an already-logged entry, portion re-picking doesn't apply here
    fdcId: null,
    portions: null,
    portionsLoading: false,
    selectedPortionIdx: null,
    portionGrams: 100,
  };
  render();
}

const USDA_FOOD_DETAIL_URL = 'https://api.nal.usda.gov/fdc/v1/food';

// Real household portions ("1 medium", "1 cup, sliced") with gram weights,
// straight from USDA's food detail endpoint, fetched lazily only when someone
// actually adjusts a per-100g result (not for every search result up front,
// that would be a lot of extra network calls for portions most people never
// look at). Cached per fdcId so repeat lookups are free.
async function fetchUsdaPortions(fdcId) {
  const cached = STATE.usdaPortionsCache[fdcId];
  if (cached) return cached.portions;
  try {
    const apiKey = STATE.foodApiKey || 'DEMO_KEY';
    const url = `${USDA_FOOD_DETAIL_URL}/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('USDA detail fetch failed: ' + res.status);
    const data = await res.json();
    const portions = (data.foodPortions || [])
      .filter(p => p.gramWeight > 0)
      .map(p => ({ label: describeUsdaPortion(p), grams: p.gramWeight }))
      .slice(0, 6); // keep the picker to a manageable, scannable size
    STATE.usdaPortionsCache[fdcId] = { portions, ts: Date.now() };
    persist();
    return portions;
  } catch (e) {
    console.error(e);
    return [];
  }
}

function describeUsdaPortion(p) {
  const modifier = p.modifier || 'serving';
  if (!p.amount || p.amount === 1) return modifier;
  return `${formatQty(p.amount)} ${modifier}`;
}

async function loadPortionsForDraft(fdcId) {
  const d = UI.foodAdjustDraft;
  if (!d) return;
  d.portionsLoading = true;
  render();
  const portions = await fetchUsdaPortions(fdcId);
  // The user may have cancelled or moved on to a different food while this
  // was in flight, don't clobber whatever they're looking at now.
  if (!UI.foodAdjustDraft || UI.foodAdjustDraft.fdcId !== fdcId) return;
  UI.foodAdjustDraft.portions = portions;
  UI.foodAdjustDraft.portionsLoading = false;
  if (portions.length) {
    selectFoodPortion(0); // default to the first real portion, not a bare gram count
  } else {
    render();
  }
}

// Recomputes the draft's per-1x base from the chosen real portion (e.g. "1
// medium" = 118g), scaled off the food's immutable per-100g values. The
// existing 0.25/0.5/1/1.5/2/3x servings chips then apply on top of THIS, so
// "2x" means "2 medium bananas," not "200g of something."
function selectFoodPortion(idx) {
  const d = UI.foodAdjustDraft;
  const portion = d.portions[idx];
  d.selectedPortionIdx = idx;
  const scale = portion.grams / 100;
  d.base = {
    kcal: d.rawPer100g.kcal * scale,
    protein: d.rawPer100g.protein * scale,
    carbs: d.rawPer100g.carbs * scale,
    fat: d.rawPer100g.fat * scale,
  };
  d.portionGrams = portion.grams;
  rescaleAdjustDraft(1);
  render();
}

// Escape hatch back to the plain per-100g unit, for anyone who'd rather enter
// an exact weight (e.g. from a kitchen scale) than pick a household portion.
function useRawGramsForDraft() {
  const d = UI.foodAdjustDraft;
  d.selectedPortionIdx = null;
  d.base = { ...d.rawPer100g };
  d.portionGrams = 100;
  rescaleAdjustDraft(1);
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
    // Portion-picking support for USDA per-100g foods (raw ingredients like
    // "Banana, raw" don't carry a real serving size the way branded/labeled
    // foods do), see fetchUsdaPortions/selectFoodPortion above.
    rawPer100g: f.perServing === false ? { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat } : null,
    fdcId: f.fdcId || null,
    portions: null,            // null = not applicable or not loaded yet, [] = loaded with none available, [...] = real choices
    portionsLoading: false,
    selectedPortionIdx: null,  // null = using the raw 100g unit as-is
    portionGrams: 100,
  };
  if (f.perServing === false && f.fdcId) {
    loadPortionsForDraft(f.fdcId);
  }
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
  render();
}

function confirmFoodAdjust() {
  const d = UI.foodAdjustDraft;
  const isEdit = UI.editingFoodIndex != null;
  const f = {
    name: d.name,
    kcal: nonNegativeFoodNumber('fa-kcal'),
    protein: nonNegativeFoodNumber('fa-protein'),
    carbs: nonNegativeFoodNumber('fa-carbs'),
    fat: nonNegativeFoodNumber('fa-fat'),
  };
  const qty = 1; // scaling is already baked into the numbers above

  if (isEdit) {
    STATE.foodLog[UI.foodDate][UI.editingFoodIndex] = { ...f, qty };
  } else {
    addOrIncrementFood(f, qty);
  }
  grantPetFoodIfThresholdMet(UI.foodDate);
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
    kcal: nonNegativeFoodNumber('cf-kcal'),
    protein: nonNegativeFoodNumber('cf-protein'),
    carbs: nonNegativeFoodNumber('cf-carbs'),
    fat: nonNegativeFoodNumber('cf-fat'),
  };
  addOrIncrementFood(f, 1);
  grantPetFoodIfThresholdMet(UI.foodDate);
  recordRecentFood(f);
  UI.showCustomFood = false;
  persist(); render();
  toast('Added to log');
}

// Rewards a food tray item once per day, the first time that day's TOTAL
// logged calories cross a minimum (reusing MIN_SAFE_INTAKE), not once per
// item logged, so logging five small snacks doesn't outpace one real meal.
function grantPetFoodIfThresholdMet(date) {
  if (date !== todayISO()) return;
  if (STATE.pet.foodRewardedDates[date]) return; // already earned today
  const entries = STATE.foodLog[date] || [];
  const totalKcal = entries.reduce((s, e) => s + e.kcal * e.qty, 0);
  const threshold = MIN_SAFE_INTAKE[STATE.profile.sex] || MIN_SAFE_INTAKE.female;
  if (totalKcal < threshold) return;
  STATE.pet.foodInventory = (STATE.pet.foodInventory || 0) + 1;
  STATE.pet.foodRewardedDates[date] = true;
  if (typeof markPetInteraction === 'function') markPetInteraction(2);
  toast(`Passed ${Math.round(threshold)} kcal today, ${STATE.pet.name || 'your pet'} earned a meal!`);
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
  grantPetFoodIfThresholdMet(UI.foodDate);
  persist(); render();
}

function removeFoodEntry(index) {
  STATE.foodLog[UI.foodDate].splice(index, 1);
  persist(); render();
}

// Select existing log lines, save their exact portions as a reusable meal,
// and replace those lines with one consolidated row. Multiplying each entry by
// its current quantity before saving keeps today's calories and macros exactly
// unchanged and makes a later meal re-log equal to the portion built today.
function renderFoodCombinePanel(entries) {
  const count = UI.foodCombineSelected.length;
  return `<div class="food-combine-panel">
    <p class="hint">Select at least two logged lines. Forge saves them as a reusable meal and replaces only those lines with one meal row; today's totals stay the same.</p>
    <div class="field-row food-combine-actions">
      <div class="field"><label>Meal name</label><input maxlength="120" value="${escapeAttr(UI.foodCombineName)}" placeholder="e.g. Turkey sandwich" oninput="UI.foodCombineName=this.value"></div>
      <button class="btn btn-primary" onclick="combineSelectedFoodIntoMeal()" ${count < 2 ? 'disabled' : ''}>Save & combine ${count || ''}</button>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="selectAllFoodForCombine()">Select all ${entries.length}</button>
  </div>`;
}

function toggleFoodCombine() {
  if (UI.foodCombineOpen) closeFoodCombine();
  else { UI.foodCombineOpen = true; UI.foodCombineSelected = []; UI.foodCombineName = ''; render(); }
}

function closeFoodCombine(shouldRender) {
  UI.foodCombineOpen = false;
  UI.foodCombineSelected = [];
  UI.foodCombineName = '';
  if (shouldRender !== false) render();
}

function toggleFoodCombineSelection(index) {
  const selected = new Set(UI.foodCombineSelected);
  if (selected.has(index)) selected.delete(index); else selected.add(index);
  UI.foodCombineSelected = Array.from(selected).sort((a, b) => a - b);
  render();
}

function selectAllFoodForCombine() {
  UI.foodCombineSelected = (STATE.foodLog[UI.foodDate] || []).map((_, index) => index);
  render();
}

function combineSelectedFoodIntoMeal() {
  const entries = STATE.foodLog[UI.foodDate] || [];
  const indexes = [...new Set(UI.foodCombineSelected)].filter(index => entries[index]).sort((a, b) => a - b);
  if (indexes.length < 2) { toast('Select at least two food lines.'); return; }
  const name = String(UI.foodCombineName || '').trim().slice(0, 120);
  if (!name) { toast('Name the meal first.'); return; }
  const selected = indexes.map(index => entries[index]);
  const items = selected.map(entry => ({
    name: entry.name,
    kcal: entry.kcal * entry.qty,
    protein: entry.protein * entry.qty,
    carbs: entry.carbs * entry.qty,
    fat: entry.fat * entry.qty,
    qty: 1,
  }));
  const totals = items.reduce((sum, item) => ({
    kcal: sum.kcal + item.kcal,
    protein: sum.protein + item.protein,
    carbs: sum.carbs + item.carbs,
    fat: sum.fat + item.fat,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  STATE.savedMeals.push({ id: uid(), name, items, ...totals });
  const indexSet = new Set(indexes);
  const insertAt = indexes[0];
  const remaining = entries.filter((_, index) => !indexSet.has(index));
  remaining.splice(insertAt, 0, { name, ...totals, qty: 1 });
  STATE.foodLog[UI.foodDate] = remaining;
  closeFoodCombine(false);
  persist(); render();
  toast(`Saved and combined “${name}” without changing today's totals.`);
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
        <input type="text" id="mb-name" data-focus-id="mb-name" placeholder="e.g. Spaghetti night" value="${escapeAttr(UI.mealBuilderName)}" onchange="onMealNameInput(this.value)" onkeydown="if(event.key==='Enter') this.blur()">
      </div>

      <p class="hint" style="margin-bottom:6px;">Add items:</p>
      <div class="search-wrap" style="margin-bottom:12px;">
        <input type="text" data-focus-id="meal-search" placeholder="Search foods to add" value="${escapeAttr(UI.foodQuery)}" oninput="onFoodSearchInput(this.value)">
        ${UI.foodResults.length ? `
          <div class="food-search-results">
            ${UI.foodResults.map((f, i) => `
              <div class="food-search-item" style="cursor:pointer; display:flex; justify-content:space-between;" onclick="addItemToMeal(${i})">
                <span>${escapeAttr(formatFoodNameForUnits(f.name))}</span>
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
                <div class="name">${escapeAttr(formatFoodNameForUnits(it.name))}</div>
                <div class="meta">P ${Math.round(it.protein * it.qty)}g . C ${Math.round(it.carbs * it.qty)}g . F ${Math.round(it.fat * it.qty)}g</div>
              </div>
              <input type="number" step="0.25" min="0.25" value="${it.qty}" onchange="setMealItemQty(${i}, this.value)" onkeydown="if(event.key==='Enter') this.blur()" style="width:60px;">
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
  render();
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
  render();
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
