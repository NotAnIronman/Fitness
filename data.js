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

// Small offline fallback food DB (used if no Nutritionix API key is configured).
// Values are per typical serving. kcal, protein/carbs/fat in grams.
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
];

// Activity multipliers used for TDEE, keyed to a 0-4 "auto-detected" activity score
const ACTIVITY_LEVELS = [
  { key: 'sedentary',   label: 'Sedentary',        desc: 'Little or no structured exercise', multiplier: 1.2 },
  { key: 'light',       label: 'Lightly active',   desc: '1-3 light sessions/week or ~5-7k steps/day', multiplier: 1.375 },
  { key: 'moderate',    label: 'Moderately active',desc: '3-5 sessions/week or ~7-10k steps/day', multiplier: 1.55 },
  { key: 'active',      label: 'Active',           desc: '6-7 sessions/week or ~10-12k steps/day', multiplier: 1.725 },
  { key: 'very_active', label: 'Very active',      desc: 'Daily intense training or 12k+ steps/day, physical job', multiplier: 1.9 },
];
