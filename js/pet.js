/* ============================================================
   PET COMPANION (secret feature, off by default)
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
  persist(); render();
}
function renamePet(name) {
  STATE.pet.name = name.trim().slice(0, 24) || 'Pet';
  persist(); render();
}
function togglePetChangePanel() {
  UI.petChangePanelOpen = !UI.petChangePanelOpen;
  render();
}
function buyPetItem(key) {
  const item = PET_ITEMS.find(i => i.key === key);
  if (!item) return;
  if (STATE.pet.ownedItems.includes(key)) { toast('Already own that'); return; }
  if (STATE.pet.points < item.cost) { toast("Not enough points yet"); return; }
  STATE.pet.points -= item.cost;
  STATE.pet.ownedItems.push(key);
  persist(); render();
  toast(`Bought ${item.name}!`);
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
  STATE.pet.hunger = Math.min(100, STATE.pet.hunger + 35);
  STATE.pet.lastFedAt = Date.now();
  persist(); render();
  toast(`${STATE.pet.name || 'Your pet'} is happily eating!`);
}
function waterPetItem() {
  if (!STATE.pet.waterInventory) { toast('No water saved up yet, log some on the Food page first.'); return; }
  STATE.pet.waterInventory -= 1;
  STATE.pet.thirst = Math.min(100, STATE.pet.thirst + 35);
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
    return `<span class="pet-overlay pet-slot-${slotName}" style="font-size:${slotSizePx}px; width:${slotSizePx}px; height:${slotSizePx}px; ${posStyle}">${petVisual(item, item.name, slotSizePx)}</span>`;
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

    <div class="card" style="text-align:center;">
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
        <div class="stat"><div class="stat-label">Needs attention every</div><div class="stat-value" style="font-size:18px;">${PET_CARE_INTERVAL_HOURS}h</div></div>
      </div>

      <button class="btn btn-sm" style="margin-top:14px;" onclick="togglePetChangePanel()">${UI.petChangePanelOpen ? 'Close' : 'Change Pet'}</button>
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

    ${renderPetShop()}

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
    </div>
  `;
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
