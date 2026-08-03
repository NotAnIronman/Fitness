/* ============================================================
   WORKOUT LOCATIONS

   "Default location" is implicit: it adds nothing to saved data. Once a
   person opts in, locations are stored once and each dated log stores only a
   short id in workoutLogMeta. Exercises are never duplicated by location.
   ============================================================ */

const DEFAULT_WORKOUT_LOCATION_ID = '';

function getWorkoutLocations() {
  return Array.isArray(STATE.workoutLocations) ? STATE.workoutLocations : [];
}

function getWorkoutLocation(id) {
  return getWorkoutLocations().find(location => location.id === id) || null;
}

function workoutLocationName(id) {
  return getWorkoutLocation(id)?.name || 'Default location';
}

function getWorkoutLogLocationId(date) {
  const id = STATE.workoutLogMeta?.[date]?.locationId;
  return getWorkoutLocation(id) ? id : DEFAULT_WORKOUT_LOCATION_ID;
}

function ensureWorkoutLogMeta(date) {
  if (!STATE.workoutLogMeta) STATE.workoutLogMeta = {};
  if (!STATE.workoutLogMeta[date]) STATE.workoutLogMeta[date] = {};
  return STATE.workoutLogMeta[date];
}

function pruneWorkoutLogMeta(date) {
  const meta = STATE.workoutLogMeta?.[date];
  if (meta && !meta.locationId && !meta.note) delete STATE.workoutLogMeta[date];
  if (STATE.workoutLogMeta && !Object.keys(STATE.workoutLogMeta).length) delete STATE.workoutLogMeta;
}

function setWorkoutLogLocation(date, locationId) {
  if (!getWorkoutLocation(locationId)) {
    if (STATE.workoutLogMeta?.[date]) delete STATE.workoutLogMeta[date].locationId;
    pruneWorkoutLogMeta(date);
  } else {
    ensureWorkoutLogMeta(date).locationId = locationId;
  }
  persist(); render();
}

function setWorkoutPlanDayLocation(dayId, locationId) {
  const day = STATE.workoutPlan.days.find(item => item.id === dayId);
  if (!day) return;
  if (getWorkoutLocation(locationId)) day.locationId = locationId;
  else delete day.locationId;
  persist(); render();
}

function renderWorkoutLocationSelect(value, onChange, label) {
  const locations = getWorkoutLocations();
  if (!locations.length) return '';
  return `<div class="field workout-location-field">
    <label>${escapeAttr(label || 'Training location')}</label>
    <select onchange="${onChange}">
      <option value="" ${!value ? 'selected' : ''}>Default location</option>
      ${locations.map(location => `<option value="${escapeAttr(location.id)}" ${location.id === value ? 'selected' : ''}>${escapeAttr(location.name)}</option>`).join('')}
    </select>
  </div>`;
}

function renderWorkoutLocationManager() {
  const locations = getWorkoutLocations();
  return `<div class="card workout-location-manager ${onboardingStepIs('location') ? 'onboarding-focus' : ''}">
    <div class="card-title"><span>Training locations</span><button class="panel-collapse-btn" onclick="toggleWorkoutLocationManager()" aria-expanded="${UI.workoutLocationManagerOpen}" aria-label="${UI.workoutLocationManagerOpen ? 'Close' : 'Open'} training location manager">${UI.workoutLocationManagerOpen ? '−' : '+'}</button></div>
    ${UI.workoutLocationManagerOpen ? `
      <p class="hint">Optional. Add locations only when the same exercise uses meaningfully different equipment or loads. Forge stores each location once and one short reference per workout date.</p>
      <div class="field-row workout-location-add">
        <div class="field"><label for="new-workout-location">New location name</label><input id="new-workout-location" maxlength="60" placeholder="Home, Downtown Gym…" onkeydown="if(event.key==='Enter') addWorkoutLocation()"></div>
        <button class="btn btn-primary" onclick="addWorkoutLocation()">Add location</button>
      </div>
      ${locations.length ? `<div class="location-list">${locations.map(location => `<div class="location-list-row"><span>${escapeAttr(location.name)}</span><button class="btn btn-danger btn-sm" onclick="deleteWorkoutLocation('${location.id}')">Remove</button></div>`).join('')}</div>` : '<div class="empty-state">No custom locations yet. All workouts use the implicit default.</div>'}
    ` : `<span class="hint">${locations.length ? `${locations.length} custom location${locations.length === 1 ? '' : 's'}` : 'Optional; single-location tracking stays data-free.'}</span>`}
  </div>`;
}

function toggleWorkoutLocationManager() {
  UI.workoutLocationManagerOpen = !UI.workoutLocationManagerOpen;
  render();
}

function addWorkoutLocation() {
  const input = document.getElementById('new-workout-location');
  const name = String(input?.value || '').trim().slice(0, 60);
  if (!name) { toast('Enter a location name.'); return; }
  if (getWorkoutLocations().some(location => location.name.toLowerCase() === name.toLowerCase())) {
    toast('That training location already exists.'); return;
  }
  if (!STATE.workoutLocations) STATE.workoutLocations = [];
  STATE.workoutLocations.push({ id: uid(), name });
  persist(); render();
}

function deleteWorkoutLocation(locationId) {
  const location = getWorkoutLocation(locationId);
  if (!location) return;
  const affectedDates = Object.values(STATE.workoutLogMeta || {}).filter(meta => meta.locationId === locationId).length;
  const affectedDays = STATE.workoutPlan.days.filter(day => day.locationId === locationId).length;
  if ((affectedDates || affectedDays) && !window.confirm(`Remove ${location.name}? ${affectedDays} plan day(s) and ${affectedDates} logged date(s) will return to Default location.`)) return;
  STATE.workoutLocations = getWorkoutLocations().filter(item => item.id !== locationId);
  STATE.workoutPlan.days.forEach(day => { if (day.locationId === locationId) delete day.locationId; });
  Object.keys(STATE.workoutLogMeta || {}).forEach(date => {
    if (STATE.workoutLogMeta[date].locationId === locationId) {
      delete STATE.workoutLogMeta[date].locationId;
      pruneWorkoutLogMeta(date);
    }
  });
  if (!Object.keys(STATE.workoutLogMeta || {}).length) delete STATE.workoutLogMeta;
  if (!STATE.workoutLocations.length) delete STATE.workoutLocations;
  if (UI.progressLocationId === locationId) UI.progressLocationId = 'all';
  persist(); render();
}

function copyWorkoutLocationToLog(locationId, date) {
  if (getWorkoutLocation(locationId)) {
    ensureWorkoutLogMeta(date).locationId = locationId;
  } else if (STATE.workoutLogMeta) {
    if (STATE.workoutLogMeta[date]) delete STATE.workoutLogMeta[date].locationId;
    pruneWorkoutLogMeta(date);
  }
}

function canApplyWorkoutLocationToLog(date, locationId) {
  const nextId = getWorkoutLocation(locationId) ? locationId : DEFAULT_WORKOUT_LOCATION_ID;
  const currentId = getWorkoutLogLocationId(date);
  if (!(STATE.workoutLog[date] || []).length || nextId === currentId) return true;
  return window.confirm(`This date already contains work assigned to ${workoutLocationName(currentId)}. Adding ${workoutLocationName(nextId)} exercises will assign the whole dated workout to ${workoutLocationName(nextId)}. Continue?`);
}
