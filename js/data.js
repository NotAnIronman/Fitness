/* ============================================================
   DATA: Exercise library (MET values) + fallback food database
   MET = Metabolic Equivalent of Task. Calorie formula:
   kcal = MET * 3.5 * weightKg / 200 * durationMinutes
   (standard ACSM metabolic formula, per-minute burn)
   ============================================================ */

// Each exercise: id, name, bodyPart (used for the filter tabs), category (Cardio/
// Strength/Mobility/Sports, used for calc grouping), met: MET value, inputMode:
// which fields the user fills in ('duration' | 'setsRepsWeight' | 'setsReps').
//
// restAdjust: for duration-based STRENGTH entries only (things like "general gym
// session"), a session's clock time is mostly rest between sets, not continuous
// work. Applying the MET formula to the full duration overstates the burn a lot
// (a 30-minute session might be ~80% rest). restAdjust scales the effective minutes
// down to account for that. Cardio/mobility duration entries are continuous effort,
// so they don't get this adjustment (restAdjust defaults to 1).
const BODY_PARTS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Full Body', 'Mobility', 'Sports'];

const EXERCISE_LIBRARY = [
  // ---- Chest ----
  { id: 'bench',         name: 'Bench Press',              bodyPart: 'Chest', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'incline_bench',  name: 'Incline Bench Press',      bodyPart: 'Chest', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'decline_bench',  name: 'Decline Bench Press',      bodyPart: 'Chest', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'db_fly',         name: 'Dumbbell Fly',             bodyPart: 'Chest', category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'cable_crossover', name: 'Cable Crossover',         bodyPart: 'Chest', category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'pushup',         name: 'Push-ups',                 bodyPart: 'Chest', category: 'Strength', met: 8.0, inputMode: 'setsReps' },
  { id: 'chest_dip',      name: 'Chest Dip',                bodyPart: 'Chest', category: 'Strength', met: 7.0, inputMode: 'setsReps' },
  { id: 'landmine_press',  name: 'Landmine Press',          bodyPart: 'Chest', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },

  // ---- Back ----
  { id: 'deadlift',      name: 'Deadlift',                  bodyPart: 'Back', category: 'Strength', met: 6.0, inputMode: 'setsRepsWeight' },
  { id: 'row_barbell',   name: 'Barbell Row',               bodyPart: 'Back', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'pullup',        name: 'Pull-ups',                  bodyPart: 'Back', category: 'Strength', met: 8.0, inputMode: 'setsReps' },
  { id: 'chinup',        name: 'Chin-ups',                  bodyPart: 'Back', category: 'Strength', met: 8.0, inputMode: 'setsReps' },
  { id: 'lat_pulldown',  name: 'Lat Pulldown',              bodyPart: 'Back', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'seated_row',    name: 'Seated Cable Row',          bodyPart: 'Back', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'tbar_row',      name: 'T-Bar Row',                 bodyPart: 'Back', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'db_row',        name: 'Single-Arm Dumbbell Row',   bodyPart: 'Back', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'face_pull',     name: 'Face Pull',                 bodyPart: 'Back', category: 'Strength', met: 3.5, inputMode: 'setsRepsWeight' },
  { id: 'hyperextension', name: 'Back Extension',           bodyPart: 'Back', category: 'Strength', met: 4.0, inputMode: 'setsReps' },

  // ---- Shoulders ----
  { id: 'ohp',           name: 'Overhead Press',            bodyPart: 'Shoulders', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'arnold_press',  name: 'Arnold Press',               bodyPart: 'Shoulders', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'lateral_raise', name: 'Lateral Raise',              bodyPart: 'Shoulders', category: 'Strength', met: 3.5, inputMode: 'setsRepsWeight' },
  { id: 'front_raise',   name: 'Front Raise',                bodyPart: 'Shoulders', category: 'Strength', met: 3.5, inputMode: 'setsRepsWeight' },
  { id: 'rear_delt_fly', name: 'Rear Delt Fly',              bodyPart: 'Shoulders', category: 'Strength', met: 3.5, inputMode: 'setsRepsWeight' },
  { id: 'upright_row',   name: 'Upright Row',                bodyPart: 'Shoulders', category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'shrug',         name: 'Shrugs',                     bodyPart: 'Shoulders', category: 'Strength', met: 3.5, inputMode: 'setsRepsWeight' },

  // ---- Arms ----
  { id: 'bicep_curl',    name: 'Bicep Curl',                bodyPart: 'Arms', category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'hammer_curl',   name: 'Hammer Curl',                bodyPart: 'Arms', category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'preacher_curl', name: 'Preacher Curl',              bodyPart: 'Arms', category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'tricep_ext',    name: 'Tricep Extension',           bodyPart: 'Arms', category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'tricep_pushdown', name: 'Tricep Pushdown',          bodyPart: 'Arms', category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'skull_crusher', name: 'Skull Crusher',              bodyPart: 'Arms', category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'tricep_dip',    name: 'Tricep Dip (bench)',         bodyPart: 'Arms', category: 'Strength', met: 6.0, inputMode: 'setsReps' },

  // ---- Legs ----
  { id: 'squat',         name: 'Barbell Squat',             bodyPart: 'Legs', category: 'Strength', met: 6.0, inputMode: 'setsRepsWeight' },
  { id: 'goblet_squat',  name: 'Goblet Squat',                bodyPart: 'Legs', category: 'Strength', met: 5.5, inputMode: 'setsRepsWeight' },
  { id: 'legpress',      name: 'Leg Press',                 bodyPart: 'Legs', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'lunge',         name: 'Lunges',                    bodyPart: 'Legs', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },
  { id: 'bulgarian_split', name: 'Bulgarian Split Squat',    bodyPart: 'Legs', category: 'Strength', met: 5.5, inputMode: 'setsRepsWeight' },
  { id: 'rdl',           name: 'Romanian Deadlift',          bodyPart: 'Legs', category: 'Strength', met: 5.5, inputMode: 'setsRepsWeight' },
  { id: 'leg_curl',      name: 'Leg Curl',                   bodyPart: 'Legs', category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'leg_extension', name: 'Leg Extension',              bodyPart: 'Legs', category: 'Strength', met: 4.0, inputMode: 'setsRepsWeight' },
  { id: 'calf_raise',    name: 'Calf Raise',                 bodyPart: 'Legs', category: 'Strength', met: 3.5, inputMode: 'setsRepsWeight' },
  { id: 'hip_thrust',    name: 'Hip Thrust',                 bodyPart: 'Legs', category: 'Strength', met: 5.0, inputMode: 'setsRepsWeight' },

  // ---- Core ----
  { id: 'plank',         name: 'Plank',                      bodyPart: 'Core', category: 'Strength', met: 3.8, inputMode: 'duration', restAdjust: 1 },
  { id: 'side_plank',    name: 'Side Plank',                 bodyPart: 'Core', category: 'Strength', met: 3.8, inputMode: 'duration', restAdjust: 1 },
  { id: 'crunch',        name: 'Crunches',                   bodyPart: 'Core', category: 'Strength', met: 4.0, inputMode: 'setsReps' },
  { id: 'bicycle_crunch', name: 'Bicycle Crunch',             bodyPart: 'Core', category: 'Strength', met: 5.0, inputMode: 'setsReps' },
  { id: 'russian_twist', name: 'Russian Twist',              bodyPart: 'Core', category: 'Strength', met: 4.5, inputMode: 'setsReps' },
  { id: 'leg_raise',     name: 'Hanging Leg Raise',           bodyPart: 'Core', category: 'Strength', met: 5.0, inputMode: 'setsReps' },
  { id: 'ab_wheel',      name: 'Ab Wheel Rollout',            bodyPart: 'Core', category: 'Strength', met: 5.0, inputMode: 'setsReps' },
  { id: 'mountain_climber', name: 'Mountain Climbers',        bodyPart: 'Core', category: 'Strength', met: 8.0, inputMode: 'duration', restAdjust: 1 },

  // ---- Cardio ----
  { id: 'run_easy',      name: 'Running (easy, ~5mph)',        bodyPart: 'Cardio', category: 'Cardio', met: 8.3,  inputMode: 'duration' },
  { id: 'run_moderate',  name: 'Running (moderate, ~6mph)',    bodyPart: 'Cardio', category: 'Cardio', met: 9.8,  inputMode: 'duration' },
  { id: 'run_fast',      name: 'Running (fast, ~7.5mph)',      bodyPart: 'Cardio', category: 'Cardio', met: 11.8, inputMode: 'duration' },
  { id: 'walk_casual',   name: 'Walking (casual, ~2.5mph)',    bodyPart: 'Cardio', category: 'Cardio', met: 3.0,  inputMode: 'duration' },
  { id: 'walk_brisk',    name: 'Walking (brisk, ~3.5mph)',     bodyPart: 'Cardio', category: 'Cardio', met: 4.3,  inputMode: 'duration' },
  { id: 'incline_walk',  name: 'Incline Treadmill Walk',       bodyPart: 'Cardio', category: 'Cardio', met: 6.0,  inputMode: 'duration' },
  { id: 'cycling_mod',   name: 'Cycling (moderate)',            bodyPart: 'Cardio', category: 'Cardio', met: 8.0,  inputMode: 'duration' },
  { id: 'cycling_vig',   name: 'Cycling (vigorous)',            bodyPart: 'Cardio', category: 'Cardio', met: 10.0, inputMode: 'duration' },
  { id: 'swimming',      name: 'Swimming (laps, moderate)',     bodyPart: 'Cardio', category: 'Cardio', met: 6.0,  inputMode: 'duration' },
  { id: 'swimming_vig',  name: 'Swimming (laps, vigorous)',     bodyPart: 'Cardio', category: 'Cardio', met: 9.8,  inputMode: 'duration' },
  { id: 'rowing',        name: 'Rowing machine (moderate)',     bodyPart: 'Cardio', category: 'Cardio', met: 7.0,  inputMode: 'duration' },
  { id: 'elliptical',    name: 'Elliptical trainer',            bodyPart: 'Cardio', category: 'Cardio', met: 5.0,  inputMode: 'duration' },
  { id: 'jump_rope',     name: 'Jump rope',                      bodyPart: 'Cardio', category: 'Cardio', met: 11.0, inputMode: 'duration' },
  { id: 'stairmaster',   name: 'Stair climber',                  bodyPart: 'Cardio', category: 'Cardio', met: 9.0,  inputMode: 'duration' },
  { id: 'hiking',        name: 'Hiking (trail, moderate)',       bodyPart: 'Cardio', category: 'Cardio', met: 6.0,  inputMode: 'duration' },
  { id: 'dancing',       name: 'Dancing (general)',              bodyPart: 'Cardio', category: 'Cardio', met: 5.5,  inputMode: 'duration' },
  { id: 'kickboxing',    name: 'Kickboxing class',                bodyPart: 'Cardio', category: 'Cardio', met: 8.5,  inputMode: 'duration' },

  // ---- Full body / functional ----
  { id: 'burpee',        name: 'Burpees',                    bodyPart: 'Full Body', category: 'Strength', met: 8.0, inputMode: 'setsReps' },
  { id: 'kb_swing',      name: 'Kettlebell Swing',            bodyPart: 'Full Body', category: 'Strength', met: 9.8, inputMode: 'setsReps' },
  { id: 'clean_press',   name: 'Clean and Press',             bodyPart: 'Full Body', category: 'Strength', met: 6.5, inputMode: 'setsRepsWeight' },
  { id: 'thruster',      name: 'Thrusters',                   bodyPart: 'Full Body', category: 'Strength', met: 8.0, inputMode: 'setsRepsWeight' },
  { id: 'battle_ropes',  name: 'Battle Ropes',                bodyPart: 'Full Body', category: 'Strength', met: 8.0, inputMode: 'duration', restAdjust: 0.7 },
  { id: 'hiit',          name: 'HIIT circuit',                   bodyPart: 'Full Body', category: 'Cardio', met: 8.0, inputMode: 'duration' },
  { id: 'general_weights', name: 'General gym / weight session', bodyPart: 'Full Body', category: 'Strength', met: 5.0, inputMode: 'duration', restAdjust: 0.55 },
  { id: 'circuit_weights', name: 'Circuit training (weights)', bodyPart: 'Full Body', category: 'Strength', met: 7.0, inputMode: 'duration', restAdjust: 0.7 },

  // ---- Mobility ----
  { id: 'yoga',          name: 'Yoga',                   bodyPart: 'Mobility', category: 'Mobility', met: 3.0, inputMode: 'duration' },
  { id: 'pilates',       name: 'Pilates',                bodyPart: 'Mobility', category: 'Mobility', met: 3.5, inputMode: 'duration' },
  { id: 'stretching',    name: 'Stretching',             bodyPart: 'Mobility', category: 'Mobility', met: 2.5, inputMode: 'duration' },
  { id: 'foam_rolling',  name: 'Foam Rolling',            bodyPart: 'Mobility', category: 'Mobility', met: 2.5, inputMode: 'duration' },

  // ---- Sports ----
  { id: 'basketball',    name: 'Basketball (pickup)',    bodyPart: 'Sports', category: 'Sports', met: 6.5, inputMode: 'duration' },
  { id: 'soccer',        name: 'Soccer',                  bodyPart: 'Sports', category: 'Sports', met: 7.0, inputMode: 'duration' },
  { id: 'tennis',        name: 'Tennis (singles)',        bodyPart: 'Sports', category: 'Sports', met: 8.0, inputMode: 'duration' },
  { id: 'boxing',        name: 'Boxing (bag work)',       bodyPart: 'Sports', category: 'Sports', met: 7.8, inputMode: 'duration' },
  { id: 'climbing',      name: 'Rock climbing',           bodyPart: 'Sports', category: 'Sports', met: 8.0, inputMode: 'duration' },
  { id: 'golf',          name: 'Golf (walking, carrying clubs)', bodyPart: 'Sports', category: 'Sports', met: 4.8, inputMode: 'duration' },
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
    { max: 100, label: 'Light', tier: 1, note: 'Good for recovery or a warm-up day. Light if the goal is cardio training benefit.' },
    { max: 250, label: 'Light-moderate', tier: 2, note: 'A solid shorter or easier session.' },
    { max: 500, label: 'Moderate', tier: 3, note: 'In the range of a typical solid training session.' },
    { max: Infinity, label: 'Vigorous', tier: 4, note: 'A high-output session: longer, harder, or both.' },
  ],
  weekly: [
    { max: 1000, label: 'Below range', tier: 1, note: 'General guidance points to roughly 1,000-2,000 kcal/week from exercise for health benefits. Add a session or two if that is a goal.' },
    { max: 2000, label: 'On track', tier: 2, note: 'Within the commonly cited 1,000-2,000 kcal/week range for general health benefits.' },
    { max: Infinity, label: 'Above range', tier: 3, note: 'Above the general benchmark, common when training for performance or weight loss.' },
  ],
};

// Body fat % category ranges (American Council on Exercise classifications, a
// commonly cited general-population reference). Used on the Body Fat page.
const BODY_FAT_CATEGORIES = {
  female: [
    { label: 'Essential fat', min: 10, max: 13, note: 'The minimum needed for basic physical and hormonal health. Living here long-term isn\u2019t sustainable or healthy for most people.' },
    { label: 'Athletes', min: 14, max: 20, note: 'Typical of competitive athletes with dedicated training and nutrition programs.' },
    { label: 'Fitness', min: 21, max: 24, note: 'A lean, visibly toned range common among regularly active people.' },
    { label: 'Average', min: 25, max: 31, note: 'The most common range for generally healthy, moderately active women.' },
    { label: 'Above average', min: 32, max: 100, note: 'Higher body fat is linked with increased health risk over time; worth a conversation with a doctor if this is a concern.' },
  ],
  male: [
    { label: 'Essential fat', min: 2, max: 5, note: 'The minimum needed for basic physical and hormonal health. Living here long-term isn\u2019t sustainable or healthy for most people.' },
    { label: 'Athletes', min: 6, max: 13, note: 'Typical of competitive athletes with dedicated training and nutrition programs.' },
    { label: 'Fitness', min: 14, max: 17, note: 'A lean, visibly toned range common among regularly active people.' },
    { label: 'Average', min: 18, max: 24, note: 'The most common range for generally healthy, moderately active men.' },
    { label: 'Above average', min: 25, max: 100, note: 'Higher body fat is linked with increased health risk over time; worth a conversation with a doctor if this is a concern.' },
  ],
};

// Rough safety floor for daily calorie intake. Below this, even with a weight-loss
// goal, is generally considered too low to sustain without medical supervision
// (based on commonly cited minimums from public health sources: roughly 1,200
// kcal/day for women and 1,500 kcal/day for men as a general floor for unsupervised
// dieting). This is a coarse rule of thumb, not personalized medical advice.
const MIN_SAFE_INTAKE = { female: 1200, male: 1500 };
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
