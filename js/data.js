/* ============================================================
   DATA: Exercise library (MET values) + fallback food database
   MET = Metabolic Equivalent of Task. Calorie formula:
   kcal = MET * 3.5 * weightKg / 200 * durationMinutes
   (standard ACSM metabolic formula, per-minute burn)
   ============================================================ */

// Each exercise: id, name, category, metType ('cardio'|'strength'|'other'),
// met: base MET value (or a function of intensity for strength moves),
// inputMode: which fields the user fills in ('duration' | 'setsRepsWeight' | 'distance')
const EXERCISE_LIBRARY = [
  // ---- Cardio ----
  { id: 'run_easy',      name: 'Running (easy, ~5mph)',        category: 'Cardio', met: 8.3,  inputMode: 'duration' },
  { id: 'run_moderate',  name: 'Running (moderate, ~6mph)',    category: 'Cardio', met: 9.8,  inputMode: 'duration' },
  { id: 'run_fast',      name: 'Running (fast, ~7.5mph)',      category: 'Cardio', met: 11.8, inputMode: 'duration' },
  { id: 'walk_casual',   name: 'Walking (casual, ~2.5mph)',    category: 'Cardio', met: 3.0,  inputMode: 'duration' },
  { id: 'walk_brisk',    name: 'Walking (brisk, ~3.5mph)',     category: 'Cardio', met: 4.3,  inputMode: 'duration' },
  { id: 'cycling_mod',   name: 'Cycling (moderate)',            category: 'Cardio', met: 8.0,  inputMode: 'duration' },
  { id: 'cycling_vig',   name: 'Cycling (vigorous)',            category: 'Cardio', met: 10.0, inputMode: 'duration' },
  { id: 'swimming',      name: 'Swimming (laps, moderate)',     category: 'Cardio', met: 6.0,  inputMode: 'duration' },
  { id: 'rowing',        name: 'Rowing machine (moderate)',     category: 'Cardio', met: 7.0,  inputMode: 'duration' },
  { id: 'elliptical',    name: 'Elliptical trainer',            category: 'Cardio', met: 5.0,  inputMode: 'duration' },
  { id: 'jump_rope',     name: 'Jump rope',                      category: 'Cardio', met: 11.0, inputMode: 'duration' },
  { id: 'stairmaster',   name: 'Stair climber',                  category: 'Cardio', met: 9.0,  inputMode: 'duration' },
  { id: 'hiit',          name: 'HIIT circuit',                   category: 'Cardio', met: 8.0,  inputMode: 'duration' },
  { id: 'hiking',        name: 'Hiking (trail, moderate)',       category: 'Cardio', met: 6.0,  inputMode: 'duration' },

  // ---- Strength (calc via sets/reps/weight -> time-under-tension estimate) ----
  { id: 'squat',         name: 'Barbell Squat',        category: 'Strength', met: 6.0, inputMode: 'setsRepsWeight' },
  { id: 'deadlift',      name: 'Deadlift',              category: 'Strength', met: 6.0, inputMode: 'setsRepsWeight' },
  { id: 'bench',         name: 'Bench Press',           category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'ohp',           name: 'Overhead Press',        category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'row_barbell',   name: 'Barbell Row',           category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'pullup',        name: 'Pull-ups',              category: 'Strength', met: 8.0, inputMode: 'setsReps' },
  { id: 'pushup',        name: 'Push-ups',              category: 'Strength', met: 8.0, inputMode: 'setsReps' },
  { id: 'lunge',         name: 'Lunges',                category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'legpress',      name: 'Leg Press',             category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'bicep_curl',    name: 'Bicep Curl',            category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'tricep_ext',    name: 'Tricep Extension',      category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'lat_pulldown',  name: 'Lat Pulldown',          category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'general_weights', name: 'General weight training', category: 'Strength', met: 5.0, inputMode: 'duration' },
  { id: 'circuit_weights', name: 'Circuit training (weights)', category: 'Strength', met: 7.0, inputMode: 'duration' },

  // ---- Other / mobility ----
  { id: 'yoga',          name: 'Yoga',                   category: 'Mobility', met: 3.0, inputMode: 'duration' },
  { id: 'pilates',       name: 'Pilates',                category: 'Mobility', met: 3.5, inputMode: 'duration' },
  { id: 'stretching',    name: 'Stretching',             category: 'Mobility', met: 2.5, inputMode: 'duration' },

  // ---- Sports ----
  { id: 'basketball',    name: 'Basketball (pickup)',    category: 'Sports', met: 6.5, inputMode: 'duration' },
  { id: 'soccer',        name: 'Soccer',                  category: 'Sports', met: 7.0, inputMode: 'duration' },
  { id: 'tennis',        name: 'Tennis (singles)',        category: 'Sports', met: 8.0, inputMode: 'duration' },
  { id: 'boxing',        name: 'Boxing (bag work)',       category: 'Sports', met: 7.8, inputMode: 'duration' },
  { id: 'climbing',      name: 'Rock climbing',           category: 'Sports', met: 8.0, inputMode: 'duration' },
];

// Activity multipliers used for TDEE, keyed to a 0-4 "auto-detected" activity score.
// baselineSteps: the daily step count already assumed to be "baked in" to that
// activity tier, used to calculate a bonus for steps walked ABOVE that baseline
// so we don't double count ordinary daily movement.
const ACTIVITY_LEVELS = [
  { key: 'sedentary',   label: 'Sedentary',        desc: 'Little or no structured exercise', multiplier: 1.2,   baselineSteps: 3000 },
  { key: 'light',       label: 'Lightly active',   desc: '1-3 light sessions/week or ~5-7k steps/day', multiplier: 1.375, baselineSteps: 5000 },
  { key: 'moderate',    label: 'Moderately active',desc: '3-5 sessions/week or ~7-10k steps/day', multiplier: 1.55,  baselineSteps: 7500 },
  { key: 'active',      label: 'Active',           desc: '6-7 sessions/week or ~10-12k steps/day', multiplier: 1.725, baselineSteps: 10000 },
  { key: 'very_active', label: 'Very active',      desc: 'Daily intense training or 12k+ steps/day, physical job', multiplier: 1.9, baselineSteps: 12500 },
];

// Exercise IDs whose calorie burn can overlap with a daily step count (walking/running
// naturally adds steps). Used to show a "don't double count" reminder when adding these.
const STEP_OVERLAP_EXERCISE_IDS = ['run_easy', 'run_moderate', 'run_fast', 'walk_casual', 'walk_brisk', 'hiking'];

// Rough public-health reference points for "is this a lot of exercise calories?" feedback.
// Loosely grounded in CDC/ACSM guidance: ~150-300 min/week of moderate activity is the
// general adult recommendation, which works out to roughly 1,000-2,000 kcal/week from
// exercise for a lot of people, depending on bodyweight and intensity. These are general
// reference points, not targets, and vary a lot by individual and by goal.
const EXERCISE_INTENSITY_BANDS = {
  session: [
    { max: 100, label: 'Light session', note: 'Good for recovery, mobility, or a warm-up day. Fine on its own, but on the light end if the goal is cardiovascular training benefit.' },
    { max: 250, label: 'Light-moderate session', note: 'A solid shorter or lower-intensity session.' },
    { max: 500, label: 'Moderate session', note: 'In the range commonly associated with a meaningful training effect.' },
    { max: Infinity, label: 'Vigorous session', note: 'A high-output session, typical of longer or higher-intensity training.' },
  ],
  weekly: [
    { max: 1000, label: 'Below typical guidance', note: 'Public health guidance (CDC/ACSM) commonly references roughly 1,000-2,000 kcal/week from exercise as a general benchmark for health benefits. You are under that range this week, worth adding volume if that is a goal.' },
    { max: 2000, label: 'Within typical guidance', note: 'This falls within the commonly cited 1,000-2,000 kcal/week range associated with general health benefits.' },
    { max: Infinity, label: 'Above typical guidance', note: 'Above the general 1,000-2,000 kcal/week benchmark, common for people training toward performance or weight-loss goals.' },
  ],
};

// Small offline fallback food DB, used only if the USDA lookup fails or is unavailable
// (e.g. no network, or the request is rate-limited). Values are per typical serving.
const FOOD_FALLBACK_DB = [
  { name: 'Chicken breast, grilled (100g)', kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'White rice, cooked (1 cup)', kcal: 205, protein: 4.3, carbs: 45, fat: 0.4 },
  { name: 'Brown rice, cooked (1 cup)', kcal: 216, protein: 5, carbs: 45, fat: 1.8 },
  { name: 'Egg, large (1)', kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { name: 'Oats, dry (1/2 cup)', kcal: 150, protein: 5, carbs: 27, fat: 2.5 },
  { name: 'Banana (1 medium)', kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: 'Apple (1 medium)', kcal: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: 'Almonds (1 oz / 23 nuts)', kcal: 164, protein: 6, carbs: 6, fat: 14 },
  { name: 'Peanut butter (2 tbsp)', kcal: 190, protein: 8, carbs: 6, fat: 16 },
  { name: 'Greek yogurt, plain (1 cup)', kcal: 150, protein: 25, carbs: 8, fat: 4 },
  { name: 'Whole milk (1 cup)', kcal: 149, protein: 8, carbs: 12, fat: 8 },
  { name: 'Skim milk (1 cup)', kcal: 83, protein: 8, carbs: 12, fat: 0.2 },
  { name: 'Salmon, cooked (100g)', kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { name: 'Ground beef 90/10, cooked (100g)', kcal: 176, protein: 20, carbs: 0, fat: 10 },
  { name: 'Broccoli, steamed (1 cup)', kcal: 55, protein: 3.7, carbs: 11, fat: 0.6 },
  { name: 'Sweet potato, baked (1 medium)', kcal: 103, protein: 2.3, carbs: 24, fat: 0.2 },
  { name: 'Avocado (1/2)', kcal: 120, protein: 1.5, carbs: 6, fat: 11 },
  { name: 'Olive oil (1 tbsp)', kcal: 119, protein: 0, carbs: 0, fat: 13.5 },
  { name: 'Whole wheat bread (1 slice)', kcal: 80, protein: 4, carbs: 14, fat: 1 },
  { name: 'Protein shake (1 scoop whey + water)', kcal: 120, protein: 24, carbs: 3, fat: 1.5 },
  { name: 'Pasta, cooked (1 cup)', kcal: 220, protein: 8, carbs: 43, fat: 1.3 },
  { name: 'Black beans, cooked (1 cup)', kcal: 227, protein: 15, carbs: 41, fat: 0.9 },
  { name: 'Cheddar cheese (1 oz)', kcal: 113, protein: 7, carbs: 0.4, fat: 9 },
  { name: 'Tortilla, flour (1 medium)', kcal: 140, protein: 4, carbs: 24, fat: 3.5 },
  { name: 'Orange juice (1 cup)', kcal: 110, protein: 1.7, carbs: 26, fat: 0.5 },
  { name: 'Ranch dressing (2 tbsp)', kcal: 140, protein: 0.3, carbs: 2, fat: 15 },
  { name: 'Mayonnaise (1 tbsp)', kcal: 94, protein: 0.1, carbs: 0.1, fat: 10 },
  { name: 'Soda, regular (12 fl oz)', kcal: 150, protein: 0, carbs: 39, fat: 0 },
  { name: 'Beer, regular (12 fl oz)', kcal: 153, protein: 1.6, carbs: 13, fat: 0 },
  { name: 'Wine, red or white (5 fl oz)', kcal: 125, protein: 0.1, carbs: 4, fat: 0 },
  { name: 'Butter (1 tbsp)', kcal: 102, protein: 0.1, carbs: 0, fat: 11.5 },
  { name: 'Potato chips (1 oz)', kcal: 152, protein: 2, carbs: 15, fat: 10 },
  { name: 'Chocolate chip cookie (1 medium)', kcal: 78, protein: 0.9, carbs: 10, fat: 4 },
];
