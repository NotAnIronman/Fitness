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
  if (STATE.workoutLog[date] && STATE.workoutLog[date].length > 0) {
    grant('workout', 15, 'Logged a workout');
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
      const iso = d.toISOString().slice(0, 10);
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
function updatePetHappinessForNewDay() {
  if (!STATE.pet.enabled) return;
  const today = todayISO();
  if (STATE.pet.lastSeenDate === today) return; // already handled today
  const p = STATE.pet;
  if (p.lastSeenDate) {
    const gapDays = Math.round((new Date(today) - new Date(p.lastSeenDate)) / 86400000);
    if (gapDays > 1) {
      p.happiness = Math.max(0, p.happiness - (gapDays - 1) * 8);
    } else if (gapDays === 1) {
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const yIso = yesterday.toISOString().slice(0, 10);
      const r = STATE.pet.rewardedDates[yIso];
      const hadActivity = r && (r.checkin || r.workout || r.calorie);
      p.happiness = Math.max(0, Math.min(100, p.happiness + (hadActivity ? 2 : -3)));
    }
  }
  p.lastSeenDate = today;
  persist();
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
function petClickInteract() {
  const today = todayISO();
  if (STATE.pet.lastClickDate !== today) { STATE.pet.petClicksToday = 0; STATE.pet.lastClickDate = today; }
  if (STATE.pet.petClicksToday >= 5) { toast(`${STATE.pet.name || 'Your pet'} needs a little space now, try again tomorrow!`); return; }
  STATE.pet.petClicksToday++;
  STATE.pet.happiness = Math.min(100, STATE.pet.happiness + 2);
  persist(); render();
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
  const cheer = PET_CHEER.pet[Math.floor(Math.random() * PET_CHEER.pet.length)];
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
      <div class="grid grid-3" style="margin-top:14px;">
        <div class="stat"><div class="stat-label">Points</div><div class="stat-value accent">${STATE.pet.points}</div></div>
        <div class="stat"><div class="stat-label">Mood</div><div class="stat-value" style="font-size:18px;">${mood.label} ${mood.emoji}</div></div>
        <div class="stat"><div class="stat-label">Check-in streak</div><div class="stat-value" style="font-size:18px;">${ctx.checkinStreak}d</div></div>
      </div>
      <div class="macro-bar-track" style="margin-top:12px;"><div class="macro-bar-fill" style="width:${STATE.pet.happiness}%; background:var(--accent);"></div></div>
      <div class="field" style="max-width:260px; margin:16px auto 0;">
        <label>Rename</label>
        <input type="text" data-focus-id="pet-name" value="${escapeAttr(STATE.pet.name)}" onchange="renamePet(this.value)" onkeydown="if(event.key==='Enter') this.blur()">
      </div>
      <div class="chip-row" style="justify-content:center; margin-top:10px;">
        ${PET_ANIMALS.map(a => `<button class="chip ${a.key === STATE.pet.species ? 'active' : ''}" onclick="choosePetSpecies('${a.key}')">${petIconSmall(a)}</button>`).join('')}
      </div>
    </div>

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
      ${PET_SLOTS.map(slot => {
        const items = PET_ITEMS.filter(i => i.slot === slot);
        const equippedKey = STATE.pet.equipped[slot];
        return `
          <p class="hint" style="margin: 10px 0 6px;">${PET_SLOT_LABELS[slot]}${equippedKey ? ` <button class="btn btn-ghost btn-sm" onclick="unequipPetSlot('${slot}')">Unequip</button>` : ''}</p>
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
      }).join('')}
    </div>
  `;
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
