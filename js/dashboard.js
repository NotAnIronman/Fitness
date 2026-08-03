/* ============================================================
   YOUR PAGE: modular, presentation-only tracking tiles.

   Tiles read the same STATE used by the full pages. Hiding one never disables
   its tracker. Preferences store only order/visibility/width deviations.
   ============================================================ */

const YOUR_PAGE_TILES = [
  { id: 'steps', name: 'Steps', render: renderYourStepsTile },
  { id: 'workout', name: 'Today\'s workout', render: renderYourWorkoutTile },
  { id: 'nutrition', name: 'Calories & macros', render: renderYourNutritionTile },
  { id: 'water', name: 'Water', render: renderYourWaterTile },
  { id: 'weight', name: 'Weight goal', render: renderYourWeightTile },
  { id: 'pet', name: 'Pet', render: renderYourPetTile, available: () => STATE.pet.enabled },
  // Additional page-native widgets are opt-in so V20/V21 dashboards do not
  // suddenly become crowded after upgrading.
  { id: 'step_checkin', name: 'Step check-in', render: () => renderStepCheckinCard(todayISO()), defaultVisible: false },
  { id: 'step_history', name: 'Step history', render: () => renderStepsCard(), defaultVisible: false },
  { id: 'guidance_level', name: 'Guidance level', render: () => renderKnowledgeLevelCard(), defaultVisible: false },
  { id: 'training_lens', name: 'Training lens', render: () => renderGoalTrainingLens(), defaultVisible: false },
  { id: 'goal_focus', name: 'Goal focus', render: () => renderGoalFocusCard(), defaultVisible: false },
  { id: 'water_log', name: 'Water log', render: () => renderWaterCard(todayISO()), defaultVisible: false },
  { id: 'workout_locations', name: 'Training locations', render: () => renderWorkoutLocationManager(), defaultVisible: false },
  { id: 'weekly_plan', name: 'Weekly plan', render: renderYourWeeklyPlanTile, defaultVisible: false },
  { id: 'body_fat', name: 'Body-fat estimate', render: renderYourBodyFatTile, defaultVisible: false },
  { id: 'achievements_summary', name: 'Achievements', render: renderYourAchievementsTile, defaultVisible: false },
  { id: 'pet_travel', name: 'Pet Travel', render: () => renderTravelCard(), defaultVisible: false, available: () => STATE.pet.enabled },
  { id: 'rest_timer', name: 'Rest timer', render: renderYourRestTimerTile, defaultVisible: false },
];

function availableYourPageTiles() {
  return YOUR_PAGE_TILES.filter(tile => !tile.available || tile.available());
}

function getYourPageTileOrder() {
  const ids = availableYourPageTiles().map(tile => tile.id);
  const saved = (STATE.uiPrefs.yourPageTileOrder || []).filter(id => ids.includes(id));
  return saved.concat(ids.filter(id => !saved.includes(id)));
}

function visibleYourPageTiles() {
  const byId = new Map(availableYourPageTiles().map(tile => [tile.id, tile]));
  return getYourPageTileOrder().map(id => byId.get(id)).filter(tile => tile && isYourPageTileVisible(tile));
}

function isYourPageTileVisible(tile) {
  if ((STATE.uiPrefs.yourPageHiddenTiles || []).includes(tile.id)) return false;
  return tile.defaultVisible !== false || (STATE.uiPrefs.yourPageAddedTiles || []).includes(tile.id);
}

function renderYourPage() {
  const tiles = visibleYourPageTiles();
  return `<div class="page-head">
      <p class="page-eyebrow">Dashboard</p><h1 class="page-title">Your Page</h1>
      <p class="page-sub">A personal dashboard. Move, resize, or hide tiles without turning off any underlying tracking.</p>
    </div>
    <div class="card your-page-manager${UI.yourPageManagerOpen ? '' : ' panel-card-collapsed'}">
      <div class="card-title"><span>Tile manager</span><button class="panel-collapse-btn" onclick="toggleYourPageManager()" aria-expanded="${UI.yourPageManagerOpen}" aria-label="${UI.yourPageManagerOpen ? 'Close' : 'Open'} tile manager">${UI.yourPageManagerOpen ? '−' : '+'}</button></div>
      ${UI.yourPageManagerOpen ? renderYourPageTileStore() : ''}
    </div>
    ${tiles.length ? `<div class="your-page-grid">${tiles.map(renderYourPageTileShell).join('')}</div>` : '<div class="card empty-state">Your dashboard is empty. Open Tile manager to add a tile.</div>'}`;
}

function renderYourPageTileStore() {
  return `<p class="hint">Use the arrow buttons on a tile to reorder it on any screen. Wide/standard controls its desktop width.</p>
    <div class="tile-store">${availableYourPageTiles().map(tile => `<div class="tile-store-row"><span>${escapeAttr(tile.name)}</span><button class="btn btn-sm" onclick="toggleYourPageTile('${tile.id}')" aria-label="${isYourPageTileVisible(tile) ? 'Hide' : 'Add'} ${escapeAttr(tile.name)}">${isYourPageTileVisible(tile) ? 'Hide' : 'Add'}</button></div>`).join('')}</div>`;
}

function renderYourPageTileShell(tile, index, list) {
  const wide = STATE.uiPrefs.yourPageTileSizes?.[tile.id] === 'wide';
  return `<section class="your-page-tile ${wide ? 'wide' : ''}" draggable="true" ondragstart="startYourPageTileDrag(event,'${tile.id}')" ondragover="event.preventDefault()" ondrop="dropYourPageTile(event,'${tile.id}')">
    <div class="your-page-tile-tools" aria-label="${escapeAttr(tile.name)} tile controls">
      <button class="icon-btn" onclick="moveYourPageTile('${tile.id}',-1)" ${index === 0 ? 'disabled' : ''} aria-label="Move ${escapeAttr(tile.name)} earlier">↑</button>
      <button class="icon-btn" onclick="moveYourPageTile('${tile.id}',1)" ${index === list.length - 1 ? 'disabled' : ''} aria-label="Move ${escapeAttr(tile.name)} later">↓</button>
      <button class="btn btn-sm" onclick="toggleYourPageTileSize('${tile.id}')" aria-label="Make ${escapeAttr(tile.name)} ${wide ? 'standard width' : 'wide'}">${wide ? 'Standard' : 'Wide'}</button>
      <button class="icon-btn" onclick="toggleYourPageTile('${tile.id}')" aria-label="Hide ${escapeAttr(tile.name)}">×</button>
    </div>${tile.render()}</section>`;
}

function toggleYourPageManager() { UI.yourPageManagerOpen = !UI.yourPageManagerOpen; render(); }

function toggleYourPageTile(tileId) {
  const tile = availableYourPageTiles().find(item => item.id === tileId);
  if (!tile) return;
  const hidden = new Set(STATE.uiPrefs.yourPageHiddenTiles || []);
  const added = new Set(STATE.uiPrefs.yourPageAddedTiles || []);
  if (isYourPageTileVisible(tile)) {
    if (tile.defaultVisible === false) added.delete(tileId);
    else hidden.add(tileId);
  } else {
    hidden.delete(tileId);
    if (tile.defaultVisible === false) added.add(tileId);
  }
  STATE.uiPrefs.yourPageHiddenTiles = Array.from(hidden);
  STATE.uiPrefs.yourPageAddedTiles = Array.from(added);
  persist(); render();
}

function moveYourPageTile(tileId, offset) {
  const order = getYourPageTileOrder();
  const index = order.indexOf(tileId), target = Math.max(0, Math.min(order.length - 1, index + offset));
  if (index < 0 || index === target) return;
  order.splice(target, 0, order.splice(index, 1)[0]);
  STATE.uiPrefs.yourPageTileOrder = order;
  persist(); render();
}

function startYourPageTileDrag(event, tileId) {
  UI.draggedTileId = tileId;
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', tileId); }
}

function dropYourPageTile(event, targetId) {
  event.preventDefault();
  const sourceId = UI.draggedTileId || event.dataTransfer?.getData('text/plain');
  UI.draggedTileId = null;
  const order = getYourPageTileOrder(), from = order.indexOf(sourceId), to = order.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return;
  order.splice(to, 0, order.splice(from, 1)[0]);
  STATE.uiPrefs.yourPageTileOrder = order;
  persist(); render();
}

function toggleYourPageTileSize(tileId) {
  const sizes = STATE.uiPrefs.yourPageTileSizes;
  if (sizes[tileId] === 'wide') delete sizes[tileId]; else sizes[tileId] = 'wide';
  persist(); render();
}

function renderYourStepsTile() {
  const today = STATE.dailyCheckins[todayISO()]?.steps;
  return `<div class="card"><div class="card-title">Steps</div><div class="grid grid-2"><div class="stat"><div class="stat-label">Today</div><div class="stat-value accent">${today == null ? '—' : today.toLocaleString()}</div></div><div class="stat"><div class="stat-label">Rolling average</div><div class="stat-value">${getStepsAverage().toLocaleString()}</div></div></div><button class="btn btn-sm tile-link" onclick="navigate('log')">Open step check-in</button></div>`;
}

function renderYourWorkoutTile() {
  const entries = STATE.workoutLog[todayISO()] || [];
  const completed = entries.filter(isExerciseFullyCompleted).length;
  return `<div class="card"><div class="card-title">Today's workout</div><div class="stat"><div class="stat-label">Completed exercises</div><div class="stat-value accent">${completed}<span class="unit"> / ${entries.length}</span></div></div>${getWorkoutLocations().length ? `<p class="hint">${escapeAttr(workoutLocationName(getWorkoutLogLocationId(todayISO())))}</p>` : ''}<button class="btn btn-sm tile-link" onclick="navigate('log')">Open workout log</button></div>`;
}

function renderYourNutritionTile() {
  const entries = STATE.foodLog[todayISO()] || [];
  const totals = entries.reduce((sum, item) => ({ kcal: sum.kcal + item.kcal * item.qty, protein: sum.protein + item.protein * item.qty, carbs: sum.carbs + item.carbs * item.qty, fat: sum.fat + item.fat * item.qty }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const target = getFoodTargetCalories();
  return `<div class="card"><div class="card-title">Calories & macros</div><div class="stat"><div class="stat-label">Today</div><div class="stat-value accent">${Math.round(totals.kcal)}<span class="unit">${target ? ` / ${Math.round(target)} kcal` : ' kcal'}</span></div></div><p class="hint">P ${Math.round(totals.protein)}g · C ${Math.round(totals.carbs)}g · F ${Math.round(totals.fat)}g</p><button class="btn btn-sm tile-link" onclick="navigate('food')">Open food tracking</button></div>`;
}

function renderYourWaterTile() {
  const logged = STATE.dailyWater[todayISO()]?.ml || 0, target = getWaterTargetMl(currentWeightKg());
  const imperial = STATE.profile.unitSystem === 'imperial';
  const amount = value => imperial ? Math.round(value / 29.5735) : Math.round(value / 10) / 100;
  const unit = imperial ? 'fl oz' : 'L';
  return `<div class="card"><div class="card-title">Water</div><div class="stat"><div class="stat-label">Logged today</div><div class="stat-value accent">${amount(logged)}<span class="unit">${target ? ` / ${amount(target)} ${unit}` : ` ${unit}`}</span></div></div><button class="btn btn-sm tile-link" onclick="navigate('food')">Open water log</button></div>`;
}

function renderYourWeightTile() {
  const current = currentWeightKg(), target = STATE.goal.targetWeightKg, imperial = STATE.profile.unitSystem === 'imperial';
  const display = value => value == null ? '—' : Math.round((imperial ? kgToLb(value) : value) * 10) / 10;
  return `<div class="card"><div class="card-title">Weight goal</div><div class="grid grid-2"><div class="stat"><div class="stat-label">Current</div><div class="stat-value accent">${display(current)}<span class="unit">${current ? (imperial ? ' lb' : ' kg') : ''}</span></div></div><div class="stat"><div class="stat-label">Target</div><div class="stat-value">${display(target)}<span class="unit">${target ? (imperial ? ' lb' : ' kg') : ''}</span></div></div></div><button class="btn btn-sm tile-link" onclick="navigate('goals')">Open weight goals</button></div>`;
}

function renderYourPetTile() {
  return `<div class="card"><div class="card-title">${escapeAttr(STATE.pet.name || 'Pet')}</div><div class="your-page-pet">${renderPetSprite(82)}<div><div class="stat-label">Happiness</div><div class="stat-value accent" style="font-size:22px">${Math.round(STATE.pet.happiness)}%</div><div class="hint">${STATE.pet.points} points</div></div></div><button class="btn btn-sm tile-link" onclick="navigate('pet')">Visit pet</button></div>`;
}

function renderYourWeeklyPlanTile() {
  const summary = weeklyPlanSummary();
  return `<div class="card"><div class="card-title">Weekly plan</div><div class="grid grid-3"><div class="stat"><div class="stat-label">Training days</div><div class="stat-value accent">${summary.workoutDaysPerWeek}</div></div><div class="stat"><div class="stat-label">Strength days</div><div class="stat-value">${summary.strengthDaysPerWeek}</div></div><div class="stat"><div class="stat-label">Aerobic / sport</div><div class="stat-value">${Math.round(summary.aerobicMinutes)}<span class="unit">min</span></div></div></div><button class="btn btn-sm tile-link" onclick="navigate('workouts')">Open workout plan</button></div>`;
}

function renderYourBodyFatTile() {
  const p = STATE.profile, bf = STATE.bodyFat;
  const result = calcNavyBodyFat({ sex: p.sex, waistCm: bf.waistCm, neckCm: bf.neckCm, hipCm: bf.hipCm, heightCm: p.heightCm });
  const category = result != null ? getBodyFatCategory(result, p.sex) : null;
  return `<div class="card"><div class="card-title">Body-fat estimate</div><div class="stat"><div class="stat-label">Current tape estimate</div><div class="stat-value accent">${result == null ? '—' : `${result.toFixed(1)}<span class="unit">%</span>`}</div></div><p class="hint">${category ? escapeAttr(category.label) : 'Add measurements on the Body Fat page.'}</p><button class="btn btn-sm tile-link" onclick="navigate('bodyfat')">Open body-fat estimate</button></div>`;
}

function renderYourAchievementsTile() {
  const unlocked = Object.keys(STATE.achievements.unlocked || {}).length;
  const pct = ACHIEVEMENTS.length ? Math.min(100, unlocked / ACHIEVEMENTS.length * 100) : 0;
  return `<div class="card"><div class="card-title">Achievements</div><div class="stat"><div class="stat-label">Unlocked</div><div class="stat-value accent">${unlocked}<span class="unit"> / ${ACHIEVEMENTS.length}</span></div></div><div class="progress-track" style="margin-top:10px"><div class="progress-fill" style="width:${pct}%"></div></div><button class="btn btn-sm tile-link" onclick="navigate('achievements')">Open achievements</button></div>`;
}

function renderYourRestTimerTile() {
  return `<div class="card"><div class="card-title">Rest timer</div><div class="stat"><div class="stat-label">Default duration</div><div class="stat-value accent">${STATE.workoutPlan.restTimerSeconds}<span class="unit">sec</span></div></div><button class="btn btn-primary btn-sm tile-link" onclick="quickStartRestTimer('Rest')">Start timer</button><button class="btn btn-sm tile-link" onclick="navigate('log')">Open timer settings</button></div>`;
}
