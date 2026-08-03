/* ============================================================
   PET COMPANION (enabled on fresh installs; optional in secret settings)
   Points are earned by completing workouts, hitting step check-ins/
   goals, and staying within calorie target, plus a weekly bonus for
   hitting everything all week. Spend points in the shop on wearables.
   Happiness is a light Tamagotchi-style "check in or I get a little
   sad" mechanic meant to nudge daily logging, it's cosmetic only and
   never blocks anything.
   ============================================================ */

// ---------- Daily/weekly point rewards ----------
// Idempotent: safe to call on every render. Returns newly-granted rewards this
// call (for a toast), since STATE.pet.rewardedDates/rewardedWeeks remember what
// was already paid out.
function evaluatePetDailyRewards() {
  if (!STATE.pet.enabled) return [];
  const date = todayISO();
  const granted = [];
  const already = STATE.pet.rewardedDates[date] || {};
  const record = { ...already };

  const grant = (key, amount, label) => {
    if (already[key]) return;
    STATE.pet.points += amount;
    STATE.pet.totalPointsEarned += amount;
    record[key] = true;
    granted.push({ label, points: amount });
  };

  const checkin = STATE.dailyCheckins[date];
  if (checkin) {
    grant('checkin', 5, 'Daily step check-in');
    const lvl = getActivityLevel();
    if ((checkin.steps || 0) >= lvl.baselineSteps) grant('steps', 5, 'Hit your step baseline');
  }
  if ((STATE.workoutLog[date] || []).some(hasCompletedWork)) {
    grant('workout', 15, 'Completed workout work');
  }
  const foodEntries = STATE.foodLog[date];
  if (foodEntries && foodEntries.length) {
    const target = getFoodTargetCalories();
    if (target) {
      const kcal = foodEntries.reduce((s, e) => s + e.kcal * e.qty, 0);
      if (Math.abs(kcal - target) <= target * 0.15) grant('calorie', 10, 'Stayed on calorie target');
    }
  }

  STATE.pet.rewardedDates[date] = record;

  // Weekly bonus: every one of the last 7 calendar days hit checkin+steps+workout+calorie.
  const weekKey = date; // keyed by the day the bonus was earned on
  if (!STATE.pet.rewardedWeeks[weekKey]) {
    let allWeek = true;
    for (let i = 0; i < 7; i++) {
      const d = new Date(date + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const iso = dateToLocalISO(d);
      const r = STATE.pet.rewardedDates[iso];
      if (!r || !r.checkin || !r.steps || !r.workout || !r.calorie) { allWeek = false; break; }
    }
    if (allWeek) {
      STATE.pet.points += 100;
      STATE.pet.totalPointsEarned += 100;
      STATE.pet.rewardedWeeks[weekKey] = true;
      granted.push({ label: 'Perfect week bonus!', points: 100 });
    }
  }

  if (granted.length) persist();
  return granted;
}

// ---------- Happiness (runs once per calendar day) ----------
// How often the pet needs attention to stay happy, and how fast happiness
// falls once overdue. Shortened from once-a-day to a few hours based on
// feedback that a tighter cadence actually motivated more frequent check-ins.
// Tune these two numbers to adjust the pace.
const PET_CARE_INTERVAL_HOURS = 4;
const PET_DECAY_PER_HOUR = 6;

// Call this on any genuine caring action (step check-in, logging a workout,
// logging food, feeding/watering, clicking to pet) to reset the countdown and
// give a small happiness boost.
function markPetInteraction(boost) {
  if (!STATE.pet.enabled) return;
  STATE.pet.lastInteractionAt = Date.now();
  STATE.pet.happiness = Math.min(100, STATE.pet.happiness + (boost || 5));
  persist();
}

// Derives current happiness from elapsed time since the last interaction,
// rather than mutating it incrementally once a day, this way "needing
// attention" is continuous and responsive to the shorter interval above
// instead of only ever being evaluated once every 24 hours.
// Generic version of the decay math above, used for hunger/thirst too (each
// tracked by its own "last fed/watered" timestamp instead of general
// interaction, since feeding shouldn't satisfy thirst and vice versa).
function decayPetStat(lastAtField, statField, intervalHours, decayPerHour) {
  const p = STATE.pet;
  if (!p[lastAtField]) {
    p[lastAtField] = Date.now();
    persist();
    return;
  }
  const hoursSince = (Date.now() - p[lastAtField]) / 3600000;
  if (hoursSince <= intervalHours) return;
  const overdueHours = hoursSince - intervalHours;
  const target = Math.max(0, 100 - overdueHours * decayPerHour);
  if (target < p[statField]) {
    p[statField] = target;
    persist();
  }
}

function updatePetHappinessDecay() {
  if (!STATE.pet.enabled || !STATE.pet.species) return;
  decayPetStat('lastInteractionAt', 'happiness', PET_CARE_INTERVAL_HOURS, PET_DECAY_PER_HOUR);
  decayPetStat('lastFedAt', 'hunger', PET_CARE_INTERVAL_HOURS, PET_DECAY_PER_HOUR);
  decayPetStat('lastWateredAt', 'thirst', PET_CARE_INTERVAL_HOURS, PET_DECAY_PER_HOUR);
}

function happinessMood(h) {
  if (h >= 80) return { label: 'Thrilled', emoji: '✨' };
  if (h >= 60) return { label: 'Happy', emoji: '' };
  if (h >= 35) return { label: 'Okay', emoji: '' };
  if (h >= 15) return { label: 'Missing you', emoji: '' };
  return { label: 'Lonely', emoji: '💧' };
}

// ---------- Shop / equip actions ----------
function choosePetSpecies(key) {
  STATE.pet.species = key;
  const animal = PET_ANIMALS.find(a => a.key === key);
  if (!STATE.pet.name) STATE.pet.name = animal.name;
  markOnboarding('petSpeciesChosen');
  persist(); render();
}
function renamePet(name) {
  STATE.pet.name = name.trim().slice(0, 24) || 'Pet';
  markOnboarding('petRenamed');
  persist(); render();
}
function togglePetChangePanel() {
  UI.petChangePanelOpen = !UI.petChangePanelOpen;
  if (UI.petChangePanelOpen) markOnboarding('openedPetEditor');
  else markOnboarding('closedPetEditor');
  render();
}
function togglePetCustomizePanel() {
  UI.petCustomizeOpen = !UI.petCustomizeOpen;
  if (UI.petCustomizeOpen) {
    markOnboarding('openedCustomize');
    if (STATE.onboarding.active && !STATE.pet.tutorialShopCreditGranted) {
      if (STATE.pet.ownedItems.length === 0 && STATE.pet.points < 30) {
        STATE.pet.points += 30;
        toast('Coach added a one-time 30-point welcome credit for your first cosmetic.');
      }
      STATE.pet.tutorialShopCreditGranted = true;
      persist();
    }
  } else if (STATE.pet.ownedItems.length) markOnboarding('closedCustomizeAfterPurchase');
  render();
}
function buyPetItem(key) {
  const item = PET_ITEMS.find(i => i.key === key);
  if (!item) return;
  if (STATE.pet.ownedItems.includes(key)) { toast('Already own that'); return; }
  if (STATE.pet.points < item.cost) { toast("Not enough points yet"); return; }
  STATE.pet.points -= item.cost;
  STATE.pet.ownedItems.push(key);
  STATE.pet.equipped[item.slot] = key;
  persist(); render();
  toast(`Bought and equipped ${item.name}!`);
}
function equipPetItem(slot, key) {
  STATE.pet.equipped[slot] = key;
  persist(); render();
}
function unequipPetSlot(slot) {
  delete STATE.pet.equipped[slot];
  persist(); render();
}
function feedPetItem() {
  if (!STATE.pet.foodInventory) { toast('No food saved up yet, log a meal on the Food page first.'); return; }
  STATE.pet.foodInventory -= 1;
  STATE.pet.hunger = 100;
  STATE.pet.lastFedAt = Date.now();
  persist(); render();
  toast(`${STATE.pet.name || 'Your pet'} is happily eating!`);
}
function waterPetItem() {
  if (!STATE.pet.waterInventory) { toast('No water saved up yet, log some on the Food page first.'); return; }
  STATE.pet.waterInventory -= 1;
  STATE.pet.thirst = 100;
  STATE.pet.lastWateredAt = Date.now();
  persist(); render();
  toast(`${STATE.pet.name || 'Your pet'} is drinking up!`);
}

function petClickInteract() {
  const today = todayISO();
  if (STATE.pet.lastClickDate !== today) { STATE.pet.petClicksToday = 0; STATE.pet.lastClickDate = today; }
  if (STATE.pet.petClicksToday >= 5) { toast(`${STATE.pet.name || 'Your pet'} needs a little space now, try again tomorrow!`); return; }
  STATE.pet.petClicksToday++;
  markPetInteraction(2);
  render();
}

// ---------- Rendering ----------
// Renders one wearable/base slot as either its emoji (default) or custom art,
// if an `img` URL has been set for it (see PET_ANIMALS/PET_ITEMS in data.js).
// sizePx: rendered size in pixels. Percentage sizing (width:100%) doesn't work
// here since the containing <span> has no explicit size of its own, that was
// the original bug: emoji rendered fine because text doesn't need a sized
// container, but an <img> with percentage dimensions inside an unsized
// element resolves to nothing and shows blank.
function petVisual(entry, altText, sizePx) {
  if (entry && entry.img) {
    return `<img src="${escapeAttr(entry.img)}" alt="${escapeAttr(altText)}" style="width:${sizePx}px; height:${sizePx}px; object-fit:contain; display:block;" loading="lazy">`;
  }
  return entry ? entry.emoji : '';
}

function renderPetSprite(size) {
  const animal = PET_ANIMALS.find(a => a.key === STATE.pet.species);
  if (!animal) return '';
  const eq = STATE.pet.equipped;
  const itemFor = slot => eq[slot] ? PET_ITEMS.find(i => i.key === eq[slot]) : null;
  const defaultScale = { hat: 0.45, eyewear: 0.35, face: 0.32, neck: 0.3, accessory: 0.3 };

  const slotSpan = (slotName) => {
    const item = itemFor(slotName);
    if (!item) return '';
    // A species can override where a slot sits via animal.anchors[slot] (e.g.
    // { top: '-30%', left: '48%', scale: 1.2 }), useful once custom art isn't
    // a uniform square the way emoji are. Falls back to the generic CSS
    // position (see .pet-slot-* in styles.css) when no override is set.
    const anchor = animal.anchors && animal.anchors[slotName];
    const posStyle = anchor ? `top:${anchor.top}; left:${anchor.left};` : '';
    const slotSizePx = size * defaultScale[slotName] * (anchor && anchor.scale ? anchor.scale : 1);
    const custom = getPetItemTransform(item.key);
    const baseTransform = slotName === 'accessory' ? '' : 'translateX(-50%) ';
    const customTransform = `${baseTransform}translate(${custom.x * size / 100}px, ${custom.y * size / 100}px) rotate(${custom.rotation}deg) scale(${custom.scale})`;
    return `<span class="pet-overlay pet-slot-${slotName}" data-pet-overlay-key="${escapeAttr(item.key)}" data-pet-slot="${slotName}" data-sprite-size="${size}" style="font-size:${slotSizePx}px; width:${slotSizePx}px; height:${slotSizePx}px; ${posStyle} transform:${customTransform};">${petVisual(item, item.name, slotSizePx)}</span>`;
  };

  return `
    <div class="pet-sprite" style="width:${size}px; height:${size}px; font-size:${size}px;" onclick="petClickInteract()" title="Click to give some love">
      <span class="pet-base" style="width:${size}px; height:${size}px;">${petVisual(animal, animal.name, size)}</span>
      ${slotSpan('hat')}
      ${slotSpan('eyewear')}
      ${slotSpan('face')}
      ${slotSpan('neck')}
      ${slotSpan('accessory')}
    </div>
  `;
}

// Small inline version for chip labels (search results, species picker),
// where the sprite is more compact than the main display.
function petIconSmall(entry) {
  if (entry && entry.img) {
    return `<img src="${escapeAttr(entry.img)}" alt="${escapeAttr(entry.name)}" style="width:1.1em; height:1.1em; vertical-align:-0.2em; object-fit:contain;" loading="lazy">`;
  }
  return entry ? entry.emoji : '';
}

/* ---------- Travel minigame ---------- */

// Haversine great-circle distance between two lat/lng points, in miles.
function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth's radius in miles
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Cumulative distance (in pet-steps) from the tour's start to arriving at
// each state, computed once and cached, US_STATES's array order IS the tour
// order (a hand-sequenced geographic sweep starting in Texas).
let _tourCumulativeCache = null;
function getTourCumulative() {
  if (_tourCumulativeCache) return _tourCumulativeCache;
  let cumulativeMiles = 0;
  _tourCumulativeCache = US_STATES.map((state, i) => {
    if (i > 0) {
      const prev = US_STATES[i - 1];
      cumulativeMiles += haversineMiles(prev.lat, prev.lng, state.lat, state.lng);
    }
    return { ...state, cumulativeSteps: Math.round(cumulativeMiles * STEPS_PER_MILE) };
  });
  return _tourCumulativeCache;
}

// Total pet-steps ever earned: every logged day's steps, multiplied, summed
// fresh from the check-in log itself (see the comment on travelCelebrated in
// js/storage.js for why this is derived rather than incrementally stored).
function getTotalPetSteps() {
  return Object.values(STATE.dailyCheckins).reduce((sum, entry) => sum + (entry.steps || 0), 0) * PET_STEP_MULTIPLIER;
}

// Everything the Pet page needs to show travel progress: which states have
// been reached, which is next, and how far along that next leg the pet is.
function getTravelProgress() {
  const tour = getTourCumulative();
  const totalSteps = getTotalPetSteps();
  const visited = tour.filter(s => totalSteps >= s.cumulativeSteps);
  const nextIndex = visited.length;
  const next = nextIndex < tour.length ? tour[nextIndex] : null;
  const prevCumulative = visited.length ? visited[visited.length - 1].cumulativeSteps : 0;
  const legTotal = next ? next.cumulativeSteps - prevCumulative : 0;
  const legProgress = next ? totalSteps - prevCumulative : 0;
  return {
    totalSteps,
    visited,
    next,
    legProgress,
    legTotal,
    legPct: legTotal ? Math.min(100, (legProgress / legTotal) * 100) : 100,
    complete: !next,
  };
}

// Grants any newly-arrived souvenirs since the last check, called centrally
// alongside the other pet evaluations so it's caught regardless of which
// page someone is on when they cross a threshold.
function evaluateTravelArrivals() {
  if (!STATE.pet.enabled || !STATE.pet.species) return [];
  const progress = getTravelProgress();
  const newlyArrived = progress.visited.filter(s => !STATE.pet.travelCelebrated.includes(s.key));
  if (!newlyArrived.length) return [];
  newlyArrived.forEach(s => STATE.pet.travelCelebrated.push(s.key));
  persist();
  return newlyArrived;
}

function renderTravelCard() {
  const progress = getTravelProgress();
  return `
    <div class="card">
      <div class="card-title">Travel <span style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim);">${progress.visited.length} / ${US_STATES.length} states</span></div>
      <p class="hint" style="margin-bottom:10px;">Your steps count ${PET_STEP_MULTIPLIER}x toward ${escapeAttr(STATE.pet.name)}'s own journey, walking a route through all 50 states and bringing back a souvenir from each.</p>
      ${progress.complete ? `
        <div class="empty-state"><div class="big">\ud83c\udf89</div>${escapeAttr(STATE.pet.name)} has visited every state! International trips may be next.</div>
      ` : `
        <div class="stat" style="margin-bottom:8px;">
          <div class="stat-label">Currently walking to</div>
          <div class="stat-value" style="font-size:20px;">${progress.next.souvenir.emoji} ${escapeAttr(progress.next.name)}</div>
        </div>
        <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${progress.legPct}%; background:var(--accent);"></div></div>
        <p class="hint" style="margin-top:6px;">${Math.round(progress.legProgress / STEPS_PER_MILE).toLocaleString()} of ${Math.round(progress.legTotal / STEPS_PER_MILE).toLocaleString()} pet-miles there.</p>
      `}
      ${progress.visited.length ? `
        <p class="hint" style="margin: 12px 0 6px;">Souvenirs collected:</p>
        <div class="chip-row">
          ${progress.visited.map(s => `<span class="chip" title="${escapeAttr(s.name)}">${s.souvenir.emoji} ${escapeAttr(s.name)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/* ---------- V14 choose-your-own-route travel ---------- */
const PET_US_MAP_POINTS = {
  AL:[68,69], AK:[13,84], AZ:[21,61], AR:[57,64], CA:[8,50], CO:[33,46],
  CT:[90,34], DE:[89,45], FL:[80,86], GA:[75,70], HI:[30,91], ID:[20,25],
  IL:[62,43], IN:[66,42], IA:[54,36], KS:[46,50], KY:[70,52], LA:[58,78],
  ME:[94,12], MD:[85,46], MA:[93,28], MI:[68,29], MN:[53,23], MS:[62,70],
  MO:[57,51], MT:[29,15], NE:[44,38], NV:[14,40], NH:[91,18], NJ:[88,40],
  NM:[32,64], NY:[85,28], NC:[82,57], ND:[43,15], OH:[73,41], OK:[48,60],
  OR:[11,22], PA:[82,37], RI:[97,35], SC:[79,64], SD:[43,27], TN:[68,58],
  TX:[45,77], UT:[22,43], VT:[88,20], VA:[82,49], WA:[12,10], WV:[77,48],
  WI:[61,27], WY:[31,31],
};

function getState(key) { return US_STATES.find(state => state.key === key); }
function travelTier(key) { return PET_TRAVEL_DIFFICULTIES[key] || PET_TRAVEL_DIFFICULTIES.silver; }
function lowerTravelTier(key) {
  const nextRank = Math.max(1, travelTier(key).rank - 1);
  return Object.keys(PET_TRAVEL_DIFFICULTIES).find(k => PET_TRAVEL_DIFFICULTIES[k].rank === nextRank) || 'bronze';
}

function ensurePetTravelState() {
  const travel = STATE.pet.travel;
  if (!getState(travel.currentState)) travel.currentState = 'TX';
  if (!PET_TRAVEL_DIFFICULTIES[travel.difficulty]) travel.difficulty = 'silver';
  travel.souvenirs = Array.from(new Set(travel.souvenirs.filter(key => getState(key))));
  Object.keys(travel.medals).forEach(key => {
    if (!getState(key) || !PET_TRAVEL_DIFFICULTIES[travel.medals[key]]) delete travel.medals[key];
  });
  Object.keys(travel.processedSteps).forEach(date => {
    const value = Number(travel.processedSteps[date]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value) || value < 0) delete travel.processedSteps[date];
    else travel.processedSteps[date] = Math.min(PET_TRAVEL_DAILY_STEP_CAP, value);
  });
  if (travel.leg) {
    const validLeg = getState(travel.leg.from) && getState(travel.leg.to) && travel.leg.from !== travel.leg.to &&
      Number.isFinite(Number(travel.leg.distanceSteps)) && Number(travel.leg.distanceSteps) > 0;
    if (!validLeg) { travel.leg = null; travel.targetState = null; }
    else {
      travel.leg.distanceSteps = Number(travel.leg.distanceSteps);
      travel.leg.progressSteps = Math.max(0, Math.min(travel.leg.distanceSteps, Number(travel.leg.progressSteps) || 0));
      if (!PET_TRAVEL_DIFFICULTIES[travel.leg.medalTier]) travel.leg.medalTier = travel.difficulty;
      travel.targetState = travel.leg.to;
    }
  }
  // V13 saves stored only arrived state keys. Preserve those as Silver and
  // consume historical entries once so upgrading cannot replay old steps.
  if (!travel.migratedV14 || (STATE.pet.travelCelebrated.length && !Object.keys(travel.medals).length)) {
    const legacy = STATE.pet.travelCelebrated.filter(key => getState(key));
    legacy.forEach(key => {
      travel.medals[key] = 'silver';
      if (!travel.souvenirs.includes(key)) travel.souvenirs.push(key);
    });
    if (legacy.length) travel.currentState = legacy[legacy.length - 1];
    Object.keys(STATE.dailyCheckins).filter(date => date <= todayISO()).forEach(date => {
      travel.processedSteps[date] = Math.min(PET_TRAVEL_DAILY_STEP_CAP, Math.max(0, Number(STATE.dailyCheckins[date].steps) || 0));
    });
    travel.migratedV14 = true;
    persist();
  }
  return travel;
}

function createTravelLeg(fromKey, toKey, medalTier) {
  const from = getState(fromKey), to = getState(toKey);
  if (!from || !to || fromKey === toKey) return null;
  return { from: fromKey, to: toKey,
    distanceSteps: Math.max(1, Math.round(haversineMiles(from.lat, from.lng, to.lat, to.lng) * STEPS_PER_MILE)),
    progressSteps: 0, medalTier: medalTier || ensurePetTravelState().difficulty };
}

function selectPetTravelTarget(key) {
  const travel = ensurePetTravelState();
  if (!getState(key) || key === travel.currentState) return;
  let medalTier = travel.difficulty, retained = 0;
  if (travel.leg && travel.leg.progressSteps > 0) {
    if (!window.confirm(`Reroute to ${getState(key).name}? Earned progress carries over, but this leg's best possible medal drops one tier.`)) return;
    retained = travel.leg.progressSteps;
    medalTier = lowerTravelTier(travel.leg.medalTier);
  }
  travel.targetState = key;
  markOnboarding('travelTargetSelected');
  travel.leg = createTravelLeg(travel.currentState, key, medalTier);
  travel.leg.progressSteps = Math.min(retained, travel.leg.distanceSteps);
  persist(); render();
}

function setPetTravelDifficulty(key) {
  if (!PET_TRAVEL_DIFFICULTIES[key]) return;
  markOnboarding('travelDifficultySelected');
  const travel = ensurePetTravelState();
  if (key === travel.difficulty) { persist(); render(); return; }
  if (travel.leg && travel.leg.progressSteps > 0) {
    const lowest = travelTier(key).rank < travelTier(travel.leg.medalTier).rank ? key : travel.leg.medalTier;
    if (!window.confirm(`Change to ${travelTier(key).label}? This trip will earn the lower tier used (${travelTier(lowest).label}).`)) return;
    travel.leg.medalTier = lowest;
  }
  travel.difficulty = key;
  if (travel.leg && travelTier(key).rank < travelTier(travel.leg.medalTier).rank) travel.leg.medalTier = key;
  persist(); render();
}

// Applies only unused, non-future steps. The highest amount ever credited for
// a date is retained so reducing then re-adding a log cannot duplicate travel.
function evaluateTravelArrivals() {
  if (!STATE.pet.enabled || !STATE.pet.species) return [];
  const travel = ensurePetTravelState();
  if (!travel.leg || STATE.pet.happiness < PET_TRAVEL_MIN_HAPPINESS) return [];
  const arrivals = [];
  let changed = false;
  const dates = Object.keys(STATE.dailyCheckins).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= todayISO()).sort();
  for (const date of dates) {
    if (!travel.leg) break;
    const eligible = Math.min(PET_TRAVEL_DAILY_STEP_CAP, Math.max(0, Number(STATE.dailyCheckins[date].steps) || 0));
    const used = Math.min(eligible, Math.max(0, Number(travel.processedSteps[date]) || 0));
    const available = eligible - used;
    if (available <= 0) continue;
    const multiplier = travelTier(travel.difficulty).multiplier;
    const consumed = Math.min(available, (travel.leg.distanceSteps - travel.leg.progressSteps) / multiplier);
    travel.leg.progressSteps += consumed * multiplier;
    travel.processedSteps[date] = used + consumed;
    changed = true;
    if (travel.leg.progressSteps + 0.001 >= travel.leg.distanceSteps) {
      const arrived = getState(travel.leg.to), tierKey = travel.leg.medalTier;
      const oldTier = travel.medals[arrived.key];
      if (!oldTier || travelTier(tierKey).rank > travelTier(oldTier).rank) travel.medals[arrived.key] = tierKey;
      const gotSouvenir = travelTier(tierKey).rank >= travelTier('silver').rank;
      if (gotSouvenir && !travel.souvenirs.includes(arrived.key)) travel.souvenirs.push(arrived.key);
      travel.currentState = arrived.key;
      travel.targetState = null;
      travel.leg = null;
      arrivals.push({ ...arrived, medalTier: tierKey, gotSouvenir });
    }
  }
  if (changed) persist();
  return arrivals;
}

function renderTravelMap(travel) {
  return `<div class="pet-us-map-scroll"><div class="pet-us-map" role="group" aria-label="Choose a destination state">
    <img class="pet-us-map-art" src="assets/us-states-cc0.svg" alt="Map of the United States with state boundaries">
    <div class="pet-us-map-markers">${US_STATES.map(state => {
    const pos = PET_US_MAP_POINTS[state.key];
    const tierKey = travel.medals[state.key], tier = tierKey ? travelTier(tierKey) : null;
    const status = state.key === travel.currentState ? 'Here' : tier ? tier.label : 'Not completed';
    return `<button class="pet-map-state ${tier ? `completed tier-${tierKey}` : ''} ${state.key === travel.currentState ? 'current' : ''} ${state.key === travel.targetState ? 'target' : ''}" style="left:${pos[0]}%;top:${pos[1]}%;" onclick="selectPetTravelTarget('${state.key}')" title="${escapeAttr(state.name)}: ${status}" aria-label="${escapeAttr(state.name)}, ${status}"><span>${state.key}</span><small>${state.key === travel.currentState ? '●' : tier ? tier.medal : '○'}</small></button>`;
  }).join('')}</div></div></div>
  <div class="pet-map-destination-control">
    <label for="pet-travel-state-select">Accessible destination selector</label>
    <div class="field-row">
      <select id="pet-travel-state-select" aria-label="Destination state">${US_STATES.filter(state => state.key !== travel.currentState).map(state => {
        const tierKey = travel.medals[state.key];
        const status = tierKey ? travelTier(tierKey).label : 'not completed';
        return `<option value="${state.key}" ${state.key === travel.targetState ? 'selected' : ''}>${escapeAttr(state.name)} — ${status}</option>`;
      }).join('')}</select>
      <button class="btn btn-sm" onclick="selectPetTravelTargetFromControl()">Set destination</button>
    </div>
  </div>
  <p class="map-credit">Map outline: <a href="https://commons.wikimedia.org/wiki/File:Blank_US_Map_(states_only).svg" target="_blank" rel="noopener noreferrer">Heitordp / Wikimedia Commons, CC0</a></p>`;
}

function selectPetTravelTargetFromControl() {
  const select = document.getElementById('pet-travel-state-select');
  if (select && select.value) selectPetTravelTarget(select.value);
}

function renderTravelCard() {
  const travel = ensurePetTravelState(), current = getState(travel.currentState);
  const target = travel.leg ? getState(travel.leg.to) : null;
  const pct = travel.leg ? Math.min(100, travel.leg.progressSteps / travel.leg.distanceSteps * 100) : 0;
  const locked = STATE.pet.happiness < PET_TRAVEL_MIN_HAPPINESS;
  return `<div class="card ${['travel_info','travel_difficulty','travel_target'].some(onboardingStepIs) ? 'onboarding-focus' : ''}">
    <div class="card-title">Pet Travel <span class="travel-count">${Object.keys(travel.medals).length} / ${US_STATES.length} completed</span></div>
    <p class="hint">Choose any state on the map. Up to ${PET_TRAVEL_DAILY_STEP_CAP.toLocaleString()} logged steps per calendar day can move your pet; future entries wait until their date.</p>
    <div class="travel-difficulty">${Object.entries(PET_TRAVEL_DIFFICULTIES).map(([key,tier]) => `<button class="chip ${travel.difficulty === key ? 'active' : ''}" onclick="setPetTravelDifficulty('${key}')">${tier.medal} ${tier.label} 1:${tier.multiplier}</button>`).join('')}</div>
    <p class="hint">The arrival medal is the lowest tier used for the entire trip. Souvenirs require Silver or higher.</p>
    ${renderTravelMap(travel)}
    <div class="travel-route-summary"><strong>${escapeAttr(current.name)}</strong> ${target ? `→ <strong>${escapeAttr(target.name)}</strong>` : '· Select a destination'}
      ${travel.leg ? `<div class="macro-bar-track"><div class="macro-bar-fill" style="width:${pct}%;background:var(--accent);"></div></div><p class="hint">${Math.round(travel.leg.progressSteps/STEPS_PER_MILE).toLocaleString()} of ${Math.round(travel.leg.distanceSteps/STEPS_PER_MILE).toLocaleString()} pet-miles · ${travelTier(travel.leg.medalTier).medal} ${travelTier(travel.leg.medalTier).label} medal</p>` : ''}</div>
    ${locked ? `<div class="notice travel-paused"><div class="notice-body">💤 Travel paused: happiness must be at least ${PET_TRAVEL_MIN_HAPPINESS}%. Care for ${escapeAttr(STATE.pet.name)} and saved eligible steps can move them again.</div></div>` : ''}
    ${travel.souvenirs.length ? `<p class="hint souvenir-title">Souvenirs collected:</p><div class="chip-row">${travel.souvenirs.map(getState).filter(Boolean).map(s => `<span class="chip" title="${escapeAttr(s.name)}">${s.souvenir.emoji} ${escapeAttr(s.name)}</span>`).join('')}</div>` : ''}
  </div>`;
}

function renderPetTab() {

  if (!STATE.pet.species) {
    return `
      <div class="page-head">
        <p class="page-eyebrow">Companion</p>
        <h1 class="page-title">Adopt a pet</h1>
        <p class="page-sub">Pick a companion to cheer you on. You can change your mind any time, this is just for fun.</p>
      </div>
      <div class="card">
        <div class="pet-grid">
          ${PET_ANIMALS.map(a => `
            <button class="pet-pick" onclick="choosePetSpecies('${a.key}')">
              <span class="pet-pick-emoji">${petIconSmall(a)}</span>
              <span class="pet-pick-name">${a.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  const mood = happinessMood(STATE.pet.happiness);
  // The pet mentions being hungry/thirsty instead of a generic cheer when it
  // actually is one, ties the caretaking directly to what you're logging.
  let cheer;
  if (STATE.pet.hunger < 30) cheer = PET_CHEER.hungry[Math.floor(Math.random() * PET_CHEER.hungry.length)];
  else if (STATE.pet.thirst < 30) cheer = PET_CHEER.thirsty[Math.floor(Math.random() * PET_CHEER.thirsty.length)];
  else cheer = PET_CHEER.pet[Math.floor(Math.random() * PET_CHEER.pet.length)];
  const ctx = buildGameContext();

  return `
    <div class="page-head">
      <p class="page-eyebrow">Companion</p>
      <h1 class="page-title">${escapeAttr(STATE.pet.name)}</h1>
      <p class="page-sub">Earn points by checking in on steps, logging workouts, and staying on your calorie target, then spend them here.</p>
    </div>

    <div class="card ${['pet_editor','pet_species','pet_name','pet_editor_close','customize_open','customize_close'].some(onboardingStepIs) ? 'onboarding-focus' : ''}" style="text-align:center;">
      ${renderPetSprite(90)}
      <p class="hint" style="margin-top:8px; font-style:italic;">"${cheer}"</p>

      ${(STATE.pet.foodInventory > 0 || STATE.pet.waterInventory > 0) ? `
        <div class="pet-tray">
          ${Array.from({ length: STATE.pet.foodInventory }).map(() => `<button class="pet-tray-item" onclick="feedPetItem()" title="Feed">🍗</button>`).join('')}
          ${Array.from({ length: STATE.pet.waterInventory }).map(() => `<button class="pet-tray-item" onclick="waterPetItem()" title="Give water">💧</button>`).join('')}
        </div>
        <p class="hint">Tap an item to feed or water ${escapeAttr(STATE.pet.name)}. Logging meals and water on the Food page adds more here.</p>
      ` : `<p class="hint">Log a meal or some water on the Food page, it'll show up here to feed ${escapeAttr(STATE.pet.name)}.</p>`}

      <div class="grid grid-3" style="margin-top:14px;">
        <div class="stat"><div class="stat-label">Happiness</div><div class="stat-value" style="font-size:18px;">${mood.label} ${mood.emoji}</div></div>
        <div class="stat"><div class="stat-label">Hunger</div><div class="stat-value" style="font-size:18px; color:${STATE.pet.hunger < 30 ? 'var(--danger)' : 'var(--text)'};">${Math.round(STATE.pet.hunger)}%</div></div>
        <div class="stat"><div class="stat-label">Thirst</div><div class="stat-value" style="font-size:18px; color:${STATE.pet.thirst < 30 ? 'var(--danger)' : 'var(--text)'};">${Math.round(STATE.pet.thirst)}%</div></div>
      </div>
      <div class="macro-bar-track" style="margin-top:8px;"><div class="macro-bar-fill" style="width:${STATE.pet.happiness}%; background:var(--accent);"></div></div>
      <div class="macro-bar-track" style="margin-top:6px;"><div class="macro-bar-fill" style="width:${STATE.pet.hunger}%; background:#F97316;"></div></div>
      <div class="macro-bar-track" style="margin-top:6px;"><div class="macro-bar-fill" style="width:${STATE.pet.thirst}%; background:#38BDF8;"></div></div>
      <div class="grid grid-3" style="margin-top:6px;">
        <div class="stat"><div class="stat-label">Points</div><div class="stat-value accent">${STATE.pet.points}</div></div>
        <div class="stat"><div class="stat-label">Check-in streak</div><div class="stat-value" style="font-size:18px;">${ctx.checkinStreak}d</div></div>
        <div class="stat"><div class="stat-label">Grace before bars drain</div><div class="stat-value" style="font-size:18px;">${PET_CARE_INTERVAL_HOURS}h</div></div>
      </div>
      <p class="hint" style="margin-top:8px;">Bars only begin draining after ${PET_CARE_INTERVAL_HOURS} hours without a care interaction. You do not need to return on a schedule—normal logging, feeding, watering, or a pet tap refreshes care.</p>

      <div class="pet-action-row">
        <button class="btn btn-sm" onclick="togglePetChangePanel()">${UI.petChangePanelOpen ? 'Close Pet Editor' : 'Change Pet'}</button>
        <button class="btn btn-sm ${UI.petCustomizeOpen ? 'btn-primary' : ''}" onclick="togglePetCustomizePanel()">${UI.petCustomizeOpen ? 'Close Customize' : 'Customize'}</button>
      </div>
      ${UI.petChangePanelOpen ? `
        <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:14px; margin-top:10px; text-align:left;">
          <div class="field" style="max-width:260px; margin:0 auto 12px;">
            <label>Rename</label>
            <input type="text" data-focus-id="pet-name" value="${escapeAttr(STATE.pet.name)}" onchange="renamePet(this.value)" onkeydown="if(event.key==='Enter') this.blur()">
          </div>
          <p class="hint" style="text-align:center; margin-bottom:8px;">Species</p>
          <div class="chip-row" style="justify-content:center;">
            ${PET_ANIMALS.map(a => `<button class="chip ${a.key === STATE.pet.species ? 'active' : ''}" onclick="choosePetSpecies('${a.key}')">${petIconSmall(a)}</button>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>

    ${UI.petCustomizeOpen ? renderPetShop() : ''}

    ${renderTravelCard()}

    <div class="card">
      <div class="card-title">How points are earned</div>
      <div class="grid grid-2">
        <div class="hint">Daily step check-in: <strong style="color:var(--text)">+5</strong></div>
        <div class="hint">Hit your step baseline: <strong style="color:var(--text)">+5</strong></div>
        <div class="hint">Log a workout: <strong style="color:var(--text)">+15</strong></div>
        <div class="hint">Stay on calorie target: <strong style="color:var(--text)">+10</strong></div>
      </div>
      <p class="hint" style="margin-top:8px;">Hit all four, every day, for 7 days straight: <strong style="color:var(--accent)">+100 bonus</strong>.</p>
    </div>

    ${(PET_ANIMALS.some(a => a.img) || PET_ITEMS.some(i => i.img)) ? `
      <p class="hint" style="text-align:center; margin-top:8px;">Some art by <a href="https://openmoji.org" target="_blank" rel="noopener">OpenMoji</a>, licensed CC BY-SA 4.0.</p>
    ` : ''}
  `;
}

function renderPetShop() {
  return `
    <div class="card">
      <div class="card-title">Shop <span style="font-family:var(--font-mono); font-size:13px; color:var(--accent);">${STATE.pet.points} pts</span></div>
      ${PET_SLOTS.map(slot => renderShopSlot(slot)).join('')}
      ${renderPetTransformEditor()}
    </div>
  `;
}

function getPetItemTransform(itemKey) {
  const value = STATE.pet.itemTransforms?.[itemKey] || {};
  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0,
    rotation: Number(value.rotation) || 0,
    scale: Number(value.scale) || 1,
  };
}

function renderPetTransformEditor() {
  const equipped = PET_SLOTS.map(slot => ({ slot, item: PET_ITEMS.find(item => item.key === STATE.pet.equipped[slot]) })).filter(entry => entry.item);
  if (!equipped.length) return '';
  return `<hr class="div"><div class="pet-transform-editor">
    <div class="card-title">Position equipped items</div>
    <p class="hint">Move, rotate, and scale each equipped item. Placement is saved per cosmetic, so switching pets or equipment does not erase it.</p>
    <div class="pet-transform-preview">${renderPetSprite(150)}</div>
    ${equipped.map(({ slot, item }) => {
      const transform = getPetItemTransform(item.key);
      return `<details class="pet-transform-controls">
        <summary>${petIconSmall(item)} ${escapeAttr(item.name)} <span class="badge">${escapeAttr(PET_SLOT_LABELS[slot])}</span></summary>
        <div class="grid grid-2">
          ${renderPetTransformRange(item.key, 'x', 'Horizontal', -100, 100, 1, transform.x)}
          ${renderPetTransformRange(item.key, 'y', 'Vertical', -100, 100, 1, transform.y)}
          ${renderPetTransformRange(item.key, 'rotation', 'Rotation', -180, 180, 1, transform.rotation)}
          ${renderPetTransformRange(item.key, 'scale', 'Scale', 30, 250, 1, Math.round(transform.scale * 100), true)}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="resetPetItemTransform('${item.key}')">Reset placement</button>
      </details>`;
    }).join('')}
  </div>`;
}

function renderPetTransformRange(itemKey, field, label, min, max, step, value, percentScale) {
  const suffix = field === 'rotation' ? '°' : percentScale ? '%' : '% of pet';
  return `<div class="field pet-transform-field"><label>${label}: <span data-transform-label="${itemKey}:${field}">${Math.round(value)}${suffix}</span></label><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" oninput="previewPetItemTransform('${itemKey}','${field}',this.value,${percentScale ? 'true' : 'false'})" onchange="commitPetItemTransform()"></div>`;
}

function previewPetItemTransform(itemKey, field, value, percentScale) {
  if (!STATE.pet.itemTransforms) STATE.pet.itemTransforms = {};
  const next = getPetItemTransform(itemKey);
  next[field] = percentScale ? Number(value) / 100 : Number(value);
  STATE.pet.itemTransforms[itemKey] = next;
  const label = document.querySelector(`[data-transform-label="${itemKey}:${field}"]`);
  if (label) label.textContent = `${Math.round(Number(value))}${field === 'rotation' ? '°' : percentScale ? '%' : '% of pet'}`;
  document.querySelectorAll(`[data-pet-overlay-key="${itemKey}"]`).forEach(element => applyPetOverlayTransform(element, next));
}

function applyPetOverlayTransform(element, transform) {
  const size = Number(element.dataset.spriteSize) || 100;
  const base = element.dataset.petSlot === 'accessory' ? '' : 'translateX(-50%) ';
  element.style.transform = `${base}translate(${transform.x * size / 100}px, ${transform.y * size / 100}px) rotate(${transform.rotation}deg) scale(${transform.scale})`;
}

function commitPetItemTransform() { persist(); }

function resetPetItemTransform(itemKey) {
  if (STATE.pet.itemTransforms) delete STATE.pet.itemTransforms[itemKey];
  persist(); render();
}

function renderShopSlot(slot) {
  const items = PET_ITEMS.filter(i => i.slot === slot);
  const equippedKey = STATE.pet.equipped[slot];
  const header = `<p class="hint" style="margin: 10px 0 6px;">${PET_SLOT_LABELS[slot]}${equippedKey ? ` <button class="btn btn-ghost btn-sm" onclick="unequipPetSlot('${slot}')">Unequip</button>` : ''}</p>`;

  // Group by an optional `group` field on the item (e.g. "Hands", "Flowers",
  // "Tools"). Slots where nothing sets a group (most of them) just render as
  // one flat row, same as before, only slots someone has actually organized
  // into groups (typically a big "accessory" list) get the collapsible
  // sub-sections, so this doesn't add clutter anywhere it isn't needed.
  const groups = {};
  items.forEach(item => { (groups[item.group || ''] = groups[item.group || '']  || []).push(item); });
  const groupNames = Object.keys(groups);
  const hasRealGroups = groupNames.some(g => g !== '') && groupNames.length > 1;

  if (!hasRealGroups) {
    return header + renderShopChipRow(items, slot, equippedKey);
  }

  return header + groupNames.map(gName => {
    const groupKey = `${slot}:${gName}`;
    // Groups default open (undefined -> open); once someone explicitly
    // collapses one, that choice (false) sticks.
    const isOpen = UI.petShopGroupOpen[groupKey] !== false;
    const label = gName || 'Other';
    const groupItems = groups[gName];
    const ownedInGroup = groupItems.filter(i => STATE.pet.ownedItems.includes(i.key)).length;
    return `
      <button class="notice-pill" onclick="togglePetShopGroup('${groupKey}')" style="margin-bottom:6px;">
        <span class="plus">${isOpen ? '\u2212' : '+'}</span> ${escapeAttr(label)} (${groupItems.length}${ownedInGroup ? `, ${ownedInGroup} owned` : ''})
      </button>
      ${isOpen ? renderShopChipRow(groupItems, slot, equippedKey) : ''}
    `;
  }).join('');
}

function renderShopChipRow(items, slot, equippedKey) {
  return `
    <div class="chip-row" style="margin-bottom:10px;">
      ${items.map(item => {
        const owned = STATE.pet.ownedItems.includes(item.key);
        const equipped = equippedKey === item.key;
        if (owned) {
          return `<button class="chip ${equipped ? 'active' : ''}" onclick="equipPetItem('${slot}', '${item.key}')">${petIconSmall(item)} ${item.name}</button>`;
        }
        const afford = STATE.pet.points >= item.cost;
        return `<button class="chip" style="${afford ? '' : 'opacity:0.5;'}" onclick="buyPetItem('${item.key}')">${petIconSmall(item)} ${item.name} \u00b7 ${item.cost}pt</button>`;
      }).join('')}
    </div>
  `;
}

function togglePetShopGroup(key) {
  const currentlyOpen = UI.petShopGroupOpen[key] !== false;
  UI.petShopGroupOpen[key] = !currentlyOpen;
  render();
}

// ---------- Floating widget shown on every page ----------
function renderPetWidget(pageKey) {
  if (!STATE.pet.enabled || !STATE.pet.species) return '';
  const pool = (PET_CHEER[pageKey] || []).concat(PET_CHEER.generic);
  const cheer = pool[Math.floor(Math.random() * pool.length)];
  return `
    <div class="pet-widget" onclick="navigate('pet')" title="Visit your pet">
      <div class="pet-widget-bubble">${escapeAttr(cheer)}</div>
      ${renderPetSprite(46)}
    </div>
  `;
}
