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
    },
    foodLog: {
      // 'YYYY-MM-DD': [ {name, kcal, protein, carbs, fat, qty} ]
    },
    // Free USDA FoodData Central key. Optional: the app works out of the box using
    // USDA's public DEMO_KEY, this just raises the rate limit if someone wants it.
    foodApiKey: '',
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
