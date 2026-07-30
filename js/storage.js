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
      enabled: true,
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
      // Food/water: logging a meal or water on the Food page adds one to the
      // matching tray below the pet on the Pet page, tap an item to feed/water.
      foodInventory: 0,
      waterInventory: 0,
      hunger: 100,             // 0-100, decays like happiness, feeding refills it
      thirst: 100,             // 0-100, decays like happiness, watering refills it
      lastFedAt: null,
      lastWateredAt: null,
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
    return deepMerge(def, parsed);
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

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
