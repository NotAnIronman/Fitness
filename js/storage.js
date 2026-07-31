/* ============================================================
   STORAGE: everything persisted to localStorage under one key.
   Designed so a future "sync to server" swap only needs to
   replace load()/save() with API calls.
   ============================================================ */

const STORAGE_KEY = 'forge.appstate.v1';

function defaultState() {
  return {
    profile: {
      name: '',
      sex: 'female',        // 'female' | 'male'
      age: null,
      heightCm: null,
      weightKg: null,
      unitSystem: 'imperial', // 'imperial' | 'metric'
    },
    goal: {
      targetWeightKg: null,
      targetDate: null,     // ISO date string
      startWeightKg: null,
      startDate: null,      // ISO date string, set when goal created
    },
    weightLog: [
      // { date: 'YYYY-MM-DD', weightKg: 80 }
    ],
    workoutPlan: {
      days: [
        // { id, name: 'Monday', exercises: [ {id, exerciseId, sets, reps, weightKg, durationMin, distanceKm} ] }
      ],
      stepsPerDay: 6000,
      restTimerSeconds: 90, // default rest timer duration, adjustable on the Workout Log page
    },
    // Dated workout history, separate from the weekly workoutPlan template above.
    // Lets someone log what they actually did (or backfill a missed day, or plan
    // ahead) without disturbing the reusable weekly plan, and is what the Progress
    // page reads to chart strength/volume over time.
    workoutLog: {
      // 'YYYY-MM-DD': [ {id, exerciseId, sets, reps, weightKg, weightIsPerSide, durationMin} ]
    },
    foodLog: {
      // 'YYYY-MM-DD': [ {name, kcal, protein, carbs, fat, qty} ]
    },
    // Free USDA FoodData Central key. Optional: the app works out of the box using
    // USDA's public DEMO_KEY, this just raises the rate limit if someone wants it.
    foodApiKey: '',
    // Last-used body-fat measurements (US Navy method), kept so the calculator
    // doesn't reset every visit.
    bodyFat: {
      waistCm: null,
      neckCm: null,
      hipCm: null, // used for the female formula only
    },
    uiPrefs: {
      collapsedNotices: [], // notice ids the person has collapsed to a pill
    },
    // Most-recent-first quick-pick lists, since "recent items" was the most
    // requested feature: exercise ids (or 'custom:Name' for custom ones), and
    // food snapshots {name,kcal,protein,carbs,fat}. Capped in the code that
    // writes to these, not here.
    recentExercises: [],
    recentFoods: [],
    // User-built combo meals (e.g. "spaghetti night" = noodles + sauce + bread),
    // saved as a single loggable item with an editable item breakdown.
    savedMeals: [
      // { id, name, items: [{name,kcal,protein,carbs,fat,qty}], kcal, protein, carbs, fat }
    ],
    // Cache of USDA search results so repeated/similar searches don't re-hit the
    // API every time, see js/food.js for how this is used.
    usdaCache: {
      // 'querylowercase': { results: [...], ts: 169... }
    },
    // A growing pool of every food item ever returned by a USDA search, kept
    // separately from usdaCache (which is keyed per exact query string). New
    // searches check this pool first via substring match before hitting the
    // network, so the more you search, the more gets answered locally and the
    // less USDA's rate limit gets hit, this fills in over time as you use the app.
    foodIndexPool: [],
    // Daily step check-ins: an actual number logged each day, replacing the old
    // single self-reported "average steps" figure. The real rolling average is
    // computed from this history (see getStepsAverage in js/app.js) and gets more
    // accurate the more days you check in. workoutPlan.stepsPerDay below becomes
    // just a starting estimate used until enough check-ins exist.
    dailyCheckins: {
      // 'YYYY-MM-DD': { steps: 8000 }
    },
    // Water intake, logged per day in ml. Target is computed from bodyweight/sex
    // (see getWaterTargetMl in js/food.js), this just stores what's actually
    // been logged.
    dailyWater: {
      // 'YYYY-MM-DD': { ml: 1500 }
    },
    // Secret pet companion feature, off by default. Toggled from a hidden panel
    // in Themes.
    pet: {
      enabled: false,
      species: null,          // key into PET_ANIMALS, null until first chosen
      name: '',
      equipped: {},           // slot -> item key, e.g. { hat: 'top_hat' }
      ownedItems: [],         // item keys purchased from the shop
      points: 0,
      totalPointsEarned: 0,
      happiness: 80,          // 0-100, derived from how recently you've interacted, see updatePetHappinessDecay
      lastInteractionAt: null, // ms timestamp of last caring action (checkin, workout/food log, click, feed, water)
      lastSeenDate: null,      // legacy field kept so old saves still deepMerge cleanly, unused by current logic
      rewardedDates: {},      // 'YYYY-MM-DD': { checkin, steps, workout, calorie } - prevents double-awarding
      rewardedWeeks: {},      // 'weekStartYYYY-MM-DD': true - the all-metrics-hit weekly bonus
      petClicksToday: 0,      // simple click-to-pet interaction, capped per day
      lastClickDate: null,
      // Food/water: earning a tray item is tied to hitting a daily minimum
      // (not one item per food/water logged, which just rewarded spamming
      // tiny entries), see getFoodTrayThresholdKcal/getWaterTargetMl. Each is
      // granted at most once per calendar day, tracked here so re-crossing
      // the threshold later the same day (e.g. logging more food) doesn't
      // grant more than once.
      foodInventory: 0,
      waterInventory: 0,
      foodRewardedDates: {}, // 'YYYY-MM-DD': true
      waterRewardedDates: {}, // 'YYYY-MM-DD': true
      hunger: 100,             // 0-100, decays like happiness, feeding refills it
      thirst: 100,             // 0-100, decays like happiness, watering refills it
      lastFedAt: null,
      lastWateredAt: null,
      // Travel minigame: progress is fully DERIVED from the daily step
      // check-in log each time it's needed (see getTravelProgress in
      // js/pet.js), not stored incrementally, so backfilling or editing a
      // day's steps can never cause drift or double-counting. This just
      // remembers which arrivals have already gotten their "you made it!"
      // celebration, so revisiting the Pet page doesn't re-celebrate the
      // same stop every time.
      travelCelebrated: [], // state keys, e.g. ['TX', 'OK']
    },
    achievements: {
      unlocked: {}, // achievementId -> 'YYYY-MM-DD' date unlocked
    },
    theme: {
      preset: 'forge',
      bg: '#0B0F14',
      surface: '#141B22',
      surface2: '#1B242D',
      border: '#26323C',
      text: '#E7EEF3',
      textDim: '#8FA1AC',
      accent: '#5EEAD4',
      accent2: '#F97316',
      radius: 10,
      font: 'condensed',
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // shallow-merge with defaults so new fields added later don't break old saves
    const def = defaultState();
    return normalizeStateShape(deepMerge(def, sanitizeJsonValue(parsed)));
  } catch (e) {
    console.error('Failed to load state, resetting.', e);
    return defaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
  }
}

function deepMerge(base, override) {
  if (typeof base !== 'object' || base === null) return override ?? base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!override || typeof override !== 'object') return out;
  for (const key of Object.keys(override)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    if (
      typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key]) &&
      typeof override[key] === 'object' && override[key] !== null && !Array.isArray(override[key])
    ) {
      out[key] = deepMerge(base[key], override[key]);
    } else {
      out[key] = override[key];
    }
  }
  return out;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Backups are user-controlled files/text. Keep JSON bounded, remove prototype
// keys, and reject values that cannot be safely represented by the app.
function sanitizeJsonValue(value, depth) {
  depth = depth || 0;
  if (depth > 14) throw new Error('Backup nesting is too deep.');
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 2000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    if (value.length > 10000) throw new Error('Backup contains an unexpectedly large list.');
    return value.map(v => sanitizeJsonValue(v, depth + 1));
  }
  if (!isPlainObject(value)) throw new Error('Backup contains an unsupported value.');
  const out = {};
  const keys = Object.keys(value);
  if (keys.length > 20000) throw new Error('Backup contains too many fields.');
  keys.forEach(key => {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return;
    out[key] = sanitizeJsonValue(value[key], depth + 1);
  });
  return out;
}

function normalizeStateShape(state) {
  const def = defaultState();
  if (!isPlainObject(state)) throw new Error('Backup root must be an object.');
  const objectFields = ['profile', 'goal', 'workoutPlan', 'workoutLog', 'foodLog', 'bodyFat', 'uiPrefs', 'usdaCache', 'dailyCheckins', 'dailyWater', 'pet', 'achievements', 'theme'];
  objectFields.forEach(key => { if (!isPlainObject(state[key])) state[key] = def[key]; });
  const arrayFields = ['weightLog', 'recentExercises', 'recentFoods', 'savedMeals', 'foodIndexPool'];
  arrayFields.forEach(key => { if (!Array.isArray(state[key])) state[key] = def[key]; });
  state.recentFoods = state.recentFoods.slice(0, 50).map(normalizeFoodEntry).filter(Boolean);
  state.foodIndexPool = state.foodIndexPool.slice(0, 1000).map(normalizeFoodEntry).filter(Boolean);
  state.recentExercises = state.recentExercises.slice(0, 50).filter(isPlainObject).map(item => ({
    key: String(item.key || '').slice(0, 200),
    label: String(item.label || 'Exercise').slice(0, 120),
    snapshot: normalizeExerciseEntry(item.snapshot),
  })).filter(item => item.snapshot);
  state.savedMeals = state.savedMeals.slice(0, 500).filter(isPlainObject).map(meal => {
    const items = Array.isArray(meal.items) ? meal.items.slice(0, 200).map(normalizeFoodEntry).filter(Boolean) : [];
    return {
      id: safeStateId(meal.id),
      name: String(meal.name || 'Saved meal').slice(0, 120),
      items,
      kcal: Math.max(0, Number(meal.kcal) || 0),
      protein: Math.max(0, Number(meal.protein) || 0),
      carbs: Math.max(0, Number(meal.carbs) || 0),
      fat: Math.max(0, Number(meal.fat) || 0),
    };
  });
  if (!Array.isArray(state.workoutPlan.days)) state.workoutPlan.days = [];
  state.workoutPlan.days = state.workoutPlan.days.slice(0, 100).filter(isPlainObject).map(day => ({
    id: safeStateId(day.id),
    name: String(day.name || 'Training day').slice(0, 100),
    exercises: Array.isArray(day.exercises) ? day.exercises.slice(0, 500).map(normalizeExerciseEntry).filter(Boolean) : [],
  }));
  state.workoutLog = normalizeDatedLog(state.workoutLog, entry => normalizeExerciseEntry(entry));
  state.foodLog = normalizeDatedLog(state.foodLog, normalizeFoodEntry);
  if (!Array.isArray(state.uiPrefs.collapsedNotices)) state.uiPrefs.collapsedNotices = [];
  if (!Array.isArray(state.pet.ownedItems)) state.pet.ownedItems = [];
  if (!Array.isArray(state.pet.travelCelebrated)) state.pet.travelCelebrated = [];
  if (!isPlainObject(state.pet.equipped)) state.pet.equipped = {};
  if (!isPlainObject(state.pet.rewardedDates)) state.pet.rewardedDates = {};
  if (!isPlainObject(state.pet.rewardedWeeks)) state.pet.rewardedWeeks = {};
  if (!isPlainObject(state.pet.foodRewardedDates)) state.pet.foodRewardedDates = {};
  if (!isPlainObject(state.pet.waterRewardedDates)) state.pet.waterRewardedDates = {};
  if (!isPlainObject(state.achievements.unlocked)) state.achievements.unlocked = {};
  state.profile.name = String(state.profile.name || '').slice(0, 80);
  state.profile.sex = state.profile.sex === 'male' ? 'male' : 'female';
  state.profile.unitSystem = state.profile.unitSystem === 'metric' ? 'metric' : 'imperial';
  const age = Number(state.profile.age);
  const heightCm = Number(state.profile.heightCm);
  const weightKg = Number(state.profile.weightKg);
  state.profile.age = age >= 18 && age <= 100 ? age : null;
  state.profile.heightCm = heightCm >= 120 && heightCm <= 230 ? heightCm : null;
  state.profile.weightKg = weightKg >= 20 && weightKg <= 400 ? weightKg : null;
  state.workoutPlan.restTimerSeconds = Math.max(10, Math.min(900, Number(state.workoutPlan.restTimerSeconds) || 90));
  state.workoutPlan.stepsPerDay = Math.max(0, Math.min(200000, Number(state.workoutPlan.stepsPerDay) || 0));
  return state;
}

function safeStateId(value) {
  const text = String(value || '');
  return /^[A-Za-z0-9_-]{1,100}$/.test(text) ? text : uid();
}

function normalizeExerciseEntry(entry) {
  if (!isPlainObject(entry)) return null;
  const out = { ...entry, id: safeStateId(entry.id), completed: !!entry.completed };
  out.exerciseId = typeof entry.exerciseId === 'string' ? entry.exerciseId.slice(0, 100) : null;
  if (isPlainObject(entry.custom)) {
    out.custom = {
      name: String(entry.custom.name || 'Custom exercise').slice(0, 120),
      met: Math.max(1, Math.min(25, Number(entry.custom.met) || 5)),
      inputMode: 'duration',
      category: 'Custom',
    };
  }
  ['sets', 'reps', 'durationMin', 'weightKg'].forEach(key => {
    if (out[key] != null) out[key] = Math.max(0, Number(out[key]) || 0);
  });
  if (Array.isArray(entry.perSetWeights)) {
    out.perSetWeights = entry.perSetWeights.slice(0, 100).filter(isPlainObject).map(set => ({
      reps: Math.max(0, Number(set.reps) || 0),
      weightKg: Math.max(0, Number(set.weightKg) || 0),
      weightIsPerSide: !!set.weightIsPerSide,
      completed: !!set.completed,
    }));
  }
  return out;
}

function normalizeFoodEntry(entry) {
  if (!isPlainObject(entry)) return null;
  return {
    name: String(entry.name || 'Food').slice(0, 200),
    kcal: Math.max(0, Number(entry.kcal) || 0),
    protein: Math.max(0, Number(entry.protein) || 0),
    carbs: Math.max(0, Number(entry.carbs) || 0),
    fat: Math.max(0, Number(entry.fat) || 0),
    qty: Math.max(0.01, Number(entry.qty) || 1),
  };
}

function normalizeDatedLog(log, normalizeEntry) {
  const out = {};
  Object.keys(log || {}).slice(0, 5000).forEach(date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(log[date])) return;
    out[date] = log[date].slice(0, 1000).map(normalizeEntry).filter(Boolean);
  });
  return out;
}

function prepareImportedState(incoming) {
  if (!isPlainObject(incoming)) throw new Error('That file is not a Forge backup object.');
  return normalizeStateShape(deepMerge(defaultState(), sanitizeJsonValue(incoming)));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
