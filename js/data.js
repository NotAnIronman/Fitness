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

// Rough public-health reference points for "is this a lot of exercise calories?"
// feedback. The CDC's Physical Activity Guidelines for Americans recommend
// ~150-300 min/week of moderate aerobic activity for adults, that time-based
// figure is accurate as stated. The 1,000-2,000 kcal/week range below is a
// commonly cited derived estimate (roughly what that much moderate activity
// burns for an average-sized adult), not a kcal figure CDC/ACSM publish
// directly, individual burn varies a lot by bodyweight and intensity. Treat
// these as loose reference points, not targets.
const EXERCISE_INTENSITY_BANDS = {
  session: [
    { max: 100, label: 'Light', tier: 1, note: 'Good for recovery or a warm-up day. Light if the goal is cardio training benefit.' },
    { max: 250, label: 'Light-moderate', tier: 2, note: 'A solid shorter or easier session.' },
    { max: 500, label: 'Moderate', tier: 3, note: 'In the range of a typical solid training session.' },
    { max: Infinity, label: 'Vigorous', tier: 4, note: 'A high-output session: longer, harder, or both.' },
  ],
  weekly: [
    { max: 1000, label: 'Below range', tier: 1, note: 'The CDC recommends about 150-300 min/week of moderate activity for adults, which commonly works out to roughly 1,000-2,000 kcal/week for an average-sized adult. Add a session or two if that is a goal.' },
    { max: 2000, label: 'On track', tier: 2, note: 'Within the range commonly associated with the CDC\u2019s ~150-300 min/week adult activity guideline.' },
    { max: Infinity, label: 'Above range', tier: 3, note: 'Above that general benchmark, common when training for performance or weight loss.' },
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

// Rough strength-standard reference points (1RM as a multiple of bodyweight, and
// bodyweight-rep counts for pull-ups/push-ups), commonly-cited general figures used
// as an approximate "where do I rank" reference. We don't have access to a licensed
// strength-standards API (strengthlevel.com's terms explicitly prohibit automated
// access), so this is a simplified local approximation using bodyweight ratio only
// (no age adjustment), meant as a rough motivator, not a precise ranking.
const STRENGTH_STANDARDS = {
  squat:    { male: [0.75, 1.0, 1.5, 2.0, 2.5], female: [0.5, 0.75, 1.0, 1.5, 1.9] },
  bench:    { male: [0.5, 0.75, 1.0, 1.5, 2.0], female: [0.3, 0.45, 0.6, 0.9, 1.2] },
  deadlift: { male: [1.0, 1.25, 1.75, 2.25, 2.75], female: [0.65, 0.9, 1.25, 1.75, 2.2] },
  ohp:      { male: [0.35, 0.5, 0.7, 1.0, 1.3], female: [0.2, 0.3, 0.4, 0.6, 0.8] },
};
const STRENGTH_STANDARDS_REPS = {
  pullup: { male: [1, 3, 8, 15, 25], female: [1, 2, 5, 10, 18] },
  pushup: { male: [5, 15, 30, 50, 70], female: [2, 8, 20, 35, 50] },
};
const STRENGTH_TIER_LABELS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];
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

/* ============================================================
   PET COMPANION (secret feature)
   Defaults to native Unicode emoji characters (zero hosting dependency,
   zero licensing question). Every entry below can optionally be upgraded
   to real art by adding an `img` field, no other code changes needed,
   js/pet.js already checks for it and falls back to the emoji if absent.

   HOW TO ADD OPENMOJI ART TO AN ANIMAL OR ITEM:
   1. Find the emoji you want at https://openmoji.org/library (search by
      name, e.g. "dog face"). Click it, the hex codepoint is shown on its
      page (e.g. "1F436") and in the URL.
   2. Add an `img` field pointing at that codepoint via OpenMoji's own CDN:
        img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F436.svg'
      (swap 1F436 for whichever codepoint you found). No download or
      hosting needed, this loads directly from OpenMoji's GitHub repo via
      jsDelivr, which is what they recommend in their own README. To pin a
      specific version instead of always-latest, use
      .../openmoji@14.0.0/color/... - check github.com/hfg-gmuend/openmoji
      for the current release tag if you want to pin.
   3. That's it, the `emoji` field can stay as a fallback/label, `img` takes
      priority automatically wherever this animal or item is rendered.

   PER-SPECIES ACCESSORY POSITIONING:
   Wearable position (hat/eyewear/face/neck/accessory) defaults to the same
   spot for every animal, set in css/styles.css under .pet-slot-*. Custom
   art is rarely a perfect uniform square the way emoji are, so a species
   can override where a slot sits by adding an `anchors` object, only for
   the slots that actually need adjusting:
     anchors: {
       hat: { top: '-42%', left: '50%' },
       eyewear: { top: '15%', left: '48%', scale: 1.3 },
     }
   top/left are CSS position values (percentages work well since the sprite
   scales for different sizes around the app). scale is optional, a plain
   multiplier (1.3 = 30% bigger than the default relative size for that
   slot), only needed if a piece of custom art should render larger or
   smaller than usual. Easiest way to tune these: change a value, reload,
   see how the Pet page looks, repeat. Slots with no matching entry in
   `anchors` just use the shared default.
   ============================================================ */

const PET_ANIMALS = [
  { key: 'dog', emoji: '🐶', name: 'Dog', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F436.svg' },
  { key: 'cat', emoji: '🐱', name: 'Cat', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F431.svg' },
  { key: 'fox', emoji: '🦊', name: 'Fox', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F98A.svg' },
  { key: 'bear', emoji: '🐻', name: 'Bear', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F43B.svg' },
  { key: 'panda', emoji: '🐼', name: 'Panda', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F43C.svg' },
  { key: 'koala', emoji: '🐨', name: 'Koala' },
  { key: 'tiger', emoji: '🐯', name: 'Tiger', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F42F.svg' },
  { key: 'lion', emoji: '🦁', name: 'Lion', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F981.svg' },
  { key: 'cow', emoji: '🐮', name: 'Cow', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F42E.svg' },
  { key: 'pig', emoji: '🐷', name: 'Pig', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F437.svg' },
  { key: 'frog', emoji: '🐸', name: 'Frog', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F438.svg' },
  { key: 'monkey', emoji: '🐵', name: 'Monkey', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F649.svg' },
  { key: 'gorilla', emoji: '🦍', name: 'Gorilla', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F435.svg' },
  { key: 'rabbit', emoji: '🐰', name: 'Rabbit', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F430.svg' },
  { key: 'chick', emoji: '🐥', name: 'Chick', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F424.svg' },
  { key: 'chicken', emoji: '🐔', name: 'Chicken', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F414.svg' },
  { key: 'penguin', emoji: '🐧', name: 'Penguin', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F427.svg' },
  { key: 'owl', emoji: '🦉', name: 'Owl', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F989.svg' },
  { key: 'unicorn', emoji: '🦄', name: 'Unicorn', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F984.svg' },
  { key: 'hamster', emoji: '🐹', name: 'Hamster', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F439.svg' },
  { key: 'wolf', emoji: '🐺', name: 'Wolf', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F43A.svg' },
  { key: 'mouse', emoji: '🐭', name: 'Mouse', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F42D.svg' },
  { key: 'raccoon', emoji: '🦝', name: 'Raccoon' },
  { key: 'raccoon', emoji: '🐞', name: 'Ladybug', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F41E.svg' },
  { key: 'horse', emoji: '🐴', name: 'Horse', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F434.svg' },
  { key: 'turtle', emoji: '🐢', name: 'Turtle', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F422.svg' },
  { key: 'crab', emoji: '🦀', name: 'Crab', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F980.svg' },
  { key: 'hedgehog', emoji: '🦔', name: 'Hedgehog', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F994.svg' },
  { key: 'octopus', emoji: '🐙', name: 'Octopus', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F419.svg' },
  { key: 'squid', emoji: '🦑', name: 'Squid', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F991.svg' },
  { key: 'dragon', emoji: '🐲', name: 'Baby Dragon', img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F432.svg' },
];

// slot: 'hat' | 'eyewear' | 'face' | 'neck' | 'accessory'
const PET_ITEMS = [
  { key: 'top_hat', slot: 'hat', emoji: '🎩', name: 'Top Hat', cost: 500, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F3A9.svg' },
  { key: 'crown', slot: 'hat', emoji: '👑', name: 'Crown', cost: 500, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F451.svg' },
  { key: 'grad_cap', slot: 'hat', emoji: '🎓', name: 'Graduation Cap', cost: 250, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F393.svg' },
  { key: 'sun_hat', slot: 'hat', emoji: '👒', name: 'Sun Hat', cost: 40, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F452.svg' },
  { key: 'cap', slot: 'hat', emoji: '🧢', name: 'Baseball Cap', cost: 45 , img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F9E2.svg' },

  { key: 'glasses', slot: 'eyewear', emoji: '👓', name: 'Nerdy Glasses', cost: 30, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F453.svg' },
  { key: 'sunglasses', slot: 'eyewear', emoji: '🕶️', name: 'Cool Shades', cost: 45, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F576.svg' },
  { key: 'goggles', slot: 'eyewear', emoji: '🥽', name: 'Goggles', cost: 35, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F97D.svg' },
  { key: 'pignose', slot: 'eyewear', emoji: '🐽', name: 'Pig Nose', cost: 80, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F43D.svg' },

  { key: 'necktie', slot: 'neck', emoji: '👔', name: 'Necktie', cost: 35, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F454.svg' },
  { key: 'dress', slot: 'neck', emoji: '👗', name: 'Necktie', cost: 35, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F457.svg' },
  { key: 'bow', slot: 'neck', emoji: '🎀', name: 'Bow', cost: 25 },
  { key: 'medal', slot: 'neck', emoji: '🏅', name: 'Gold Medal', cost: 500, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F3C5.svg' },
  { key: 'militarymedal', slot: 'neck', emoji: '🎖️', name: 'Military Medal', cost: 250, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F3C5.svg' },
  { key: 'firstplace', slot: 'neck', emoji: '🥇', name: 'First Place', cost: 500, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F3C5.svg' },
   
  { key: 'ring', slot: 'accessory', emoji: '💍', name: 'Ring', cost: 90, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F48D.svg' },
  { key: 'gem', slot: 'accessory', emoji: '💎', name: 'Gem Stone', cost: 90, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F48E.svg' },
  { key: 'star', slot: 'accessory', emoji: '🌟', name: 'Sparkle', cost: 20, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/2728.svg' },
  { key: 'heart', slot: 'accessory', emoji: '💖', name: 'Sparkling Heart', cost: 20, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F496.svg' },
  { key: 'cherryblossom', slot: 'accessory', emoji: '🌸', name: 'Cherry Blossom', cost: 15, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F338.svg' },
  { key: 'hyacinth', slot: 'accessory', emoji: '🪻', name: 'Hyacinth', cost: 15, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1FABB.svg' },
  { key: 'tulip', slot: 'accessory', emoji: '🌷', name: 'Tulip', cost: 15, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F337.svg' },
  { key: 'blossom', slot: 'accessory', emoji: '🌼', name: 'Blossom', cost: 15, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F33C.svg' },
  { key: 'butterfly', slot: 'accessory', emoji: '🦋', name: 'Butterfly Buddy', cost: 30, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F98B.svg' },
  { key: 'tea', slot: 'accessory', emoji: '🫖', name: 'Teapot', cost: 50, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1FAD6.svg' },
  { key: 'fan', slot: 'accessory', emoji: '🪭', name: 'Hand Fan', cost: 50, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1FAAD.svg' },
   
  { key: 'microphone', slot: 'accessory', emoji: '🎤', name: 'Microphone', cost: 50, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F3A4.svg' },
  { key: 'guitar', slot: 'accessory', emoji: '🎸', name: 'Guitar', cost: 50, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F3B8.svg' },
   
  { key: 'okhand', slot: 'accessory', emoji: '👌', name: 'Ok Hands', cost: 30, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F44C.svg' },
  { key: 'openhand', slot: 'accessory', emoji: '👐', name: 'Open Hands', cost: 30, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F450.svg' },
  { key: 'writinghand', slot: 'accessory', emoji: '✍️', name: 'Writing Hand', cost: 30, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/270D.svg' },
  { key: 'wavehand', slot: 'accessory', emoji: '👋', name: 'Waving Hand', cost: 30, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F590.svg' },
  { key: 'rockhand', slot: 'accessory', emoji: '🤘', name: 'Rock Hand', cost: 30, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F1918.svg' },
  { key: 'lovehand', slot: 'accessory', emoji: '🤟', name: 'Love Hand', cost: 30, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F191F.svg' },

  { key: 'wrench', slot: 'accessory', emoji: '🔧', name: 'Wrench', cost: 15, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F527.svg' },
  { key: 'saw', slot: 'accessory', emoji: '🪚', name: 'Saw', cost: 15, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1FA9A.svg' },
  { key: 'hammer', slot: 'accessory', emoji: '🔨', name: 'Hammer', cost: 15, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F528.svg' },
  { key: 'pickaxe', slot: 'accessory', emoji: '⛏️', name: 'Hammer', cost: 15, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/26CF.svg' },
  { key: 'screwdriver', slot: 'accessory', emoji: '🪛', name: 'Hammer', cost: 15, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1FA9B.svg' },
  { key: 'nutandbolt', slot: 'accessory', emoji: '🔩', name: 'Hammer', cost: 15, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F529.svg' },

  { key: 'dagger', slot: 'accessory', emoji: '🗡️', name: 'Dagger', cost: 150, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F5E1.svg' },
  { key: 'pistol', slot: 'accessory', emoji: '🔫', name: 'Dagger', cost: 150, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F52B.svg' },
  { key: 'shield', slot: 'accessory', emoji: '🛡️', name: 'Dagger', cost: 150, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1F6E1.svg' },
  { key: 'boomerang', slot: 'accessory', emoji: '🪃', name: 'Boomerang', cost: 150, img: 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/svg/1FA83.svg' },
];

const PET_SLOTS = ['hat', 'eyewear', 'face', 'neck', 'accessory'];
const PET_SLOT_LABELS = { hat: 'Hat', eyewear: 'Eyewear', face: 'Face', neck: 'Neck', accessory: 'Accessory' };

// Encouragement shown in the pet widget, some generic, some page-specific.
const PET_CHEER = {
  generic: [
    "You've got this!", "Every day you show up counts.", "Small steps still move you forward.",
    "Proud of you for checking in.", "One log at a time.", "Consistency beats perfection.",
  ],
  home: ["Let's see how today's shaping up!", "Your numbers, your pace."],
  workouts: ["Let's build a plan you'll actually stick to!", "A good plan makes the day easier."],
  log: ["Let's get today logged!", "Check things off as you go, I'll be here."],
  progress: ["Look how far you've come!", "Numbers going up is the best part."],
  goals: ["Slow and steady gets you there.", "Your pace, your goal."],
  food: ["Logging it all helps, even the small stuff.", "No judgment here, just data."],
  bodyfat: ["Knowing your numbers is powerful.", "Info, not judgment."],
  pet: ["Thanks for visiting me!", "Wanna dress me up today?"],
  achievements: ["Let's see what you've unlocked!", "Every badge tells a story."],
};

/* ============================================================
   ACHIEVEMENTS
   Each has a check(ctx) predicate and optional progress(ctx) for a
   progress bar. ctx is built fresh each evaluation in js/achievements.js
   from current STATE, see buildAchievementContext().
   ============================================================ */
const ACHIEVEMENTS = [
  // ---- Steps ----
  { id: 'first_checkin', name: 'First Steps', desc: 'Log your first daily step check-in.', category: 'Steps', points: 10,
    check: ctx => ctx.checkinCount >= 1 },
  { id: 'steps_5k', name: '5K Day', desc: 'Hit 5,000 steps in a single day.', category: 'Steps', points: 10,
    check: ctx => ctx.maxStepsDay >= 5000 },
  { id: 'steps_10k', name: '10K Day', desc: 'Hit 10,000 steps in a single day.', category: 'Steps', points: 15,
    check: ctx => ctx.maxStepsDay >= 10000 },
  { id: 'steps_15k', name: '15K Day', desc: 'Hit 15,000 steps in a single day.', category: 'Steps', points: 20,
    check: ctx => ctx.maxStepsDay >= 15000 },
  { id: 'steps_20k', name: '20K Day', desc: 'Hit 20,000 steps in a single day.', category: 'Steps', points: 30,
    check: ctx => ctx.maxStepsDay >= 20000 },
  { id: 'checkin_streak_7', name: 'Week of Steps', desc: 'Check in your steps 7 days in a row.', category: 'Steps', points: 25,
    check: ctx => ctx.checkinStreak >= 7, progress: ctx => ({ current: Math.min(ctx.checkinStreak, 7), target: 7 }) },
  { id: 'checkin_streak_30', name: 'Month of Steps', desc: 'Check in your steps 30 days in a row.', category: 'Steps', points: 75,
    check: ctx => ctx.checkinStreak >= 30, progress: ctx => ({ current: Math.min(ctx.checkinStreak, 30), target: 30 }) },
  { id: 'checkin_streak_100', name: 'Century Streak', desc: 'Check in your steps 100 days in a row.', category: 'Steps', points: 200,
    check: ctx => ctx.checkinStreak >= 100, progress: ctx => ({ current: Math.min(ctx.checkinStreak, 100), target: 100 }) },
  { id: 'checkin_total_30', name: 'Data Point Collector', desc: 'Log 30 daily step check-ins total.', category: 'Steps', points: 30,
    check: ctx => ctx.checkinCount >= 30, progress: ctx => ({ current: Math.min(ctx.checkinCount, 30), target: 30 }) },
  { id: 'avg_week_7k', name: 'On the Move', desc: 'Average 7,000+ steps across at least 5 of your last 7 calendar days.', category: 'Steps', points: 20,
    check: ctx => ctx.last7CalendarDaysLogged >= 5 && ctx.last7DayAvgSteps >= 7000 },

  // ---- Workouts ----
  { id: 'first_workout', name: 'First Rep', desc: 'Log your first workout exercise.', category: 'Workouts', points: 10,
    check: ctx => ctx.totalExercisesLogged >= 1 },
  { id: 'workouts_10', name: 'Getting Into It', desc: 'Log 10 exercises total.', category: 'Workouts', points: 20,
    check: ctx => ctx.totalExercisesLogged >= 10, progress: ctx => ({ current: Math.min(ctx.totalExercisesLogged, 10), target: 10 }) },
  { id: 'workouts_50', name: 'Regular', desc: 'Log 50 exercises total.', category: 'Workouts', points: 50,
    check: ctx => ctx.totalExercisesLogged >= 50, progress: ctx => ({ current: Math.min(ctx.totalExercisesLogged, 50), target: 50 }) },
  { id: 'workouts_100', name: 'Dedicated', desc: 'Log 100 exercises total.', category: 'Workouts', points: 100,
    check: ctx => ctx.totalExercisesLogged >= 100, progress: ctx => ({ current: Math.min(ctx.totalExercisesLogged, 100), target: 100 }) },
  { id: 'workout_streak_7', name: 'Weekly Grind', desc: 'Log a workout on 7 days in a row.', category: 'Workouts', points: 30,
    check: ctx => ctx.workoutStreak >= 7, progress: ctx => ({ current: Math.min(ctx.workoutStreak, 7), target: 7 }) },
  { id: 'all_body_parts', name: 'Well Rounded', desc: 'Log an exercise from every major body part.', category: 'Workouts', points: 40,
    check: ctx => ctx.bodyPartsTouched >= 7, progress: ctx => ({ current: ctx.bodyPartsTouched, target: 7 }) },
  { id: 'ramping_master', name: 'Ramping Up', desc: 'Log an exercise with a different weight per set.', category: 'Workouts', points: 15,
    check: ctx => ctx.usedPerSetWeights },
  { id: 'personal_record', name: 'Personal Record', desc: 'Beat your starting weight on any exercise.', category: 'Workouts', points: 35,
    check: ctx => ctx.hasPersonalRecord },
  { id: 'plan_builder', name: 'Planner', desc: 'Build a workout plan with 3+ active training days.', category: 'Workouts', points: 20,
    check: ctx => ctx.activeplanDays >= 3, progress: ctx => ({ current: Math.min(ctx.activeplanDays, 3), target: 3 }) },

  // ---- Nutrition ----
  { id: 'first_meal', name: 'First Bite', desc: 'Log your first food item.', category: 'Nutrition', points: 10,
    check: ctx => ctx.totalFoodDaysLogged >= 1 },
  { id: 'on_target_day', name: 'Right on Target', desc: 'Log food within 10% of your target for one day.', category: 'Nutrition', points: 15,
    check: ctx => ctx.onTargetDays >= 1 },
  { id: 'on_target_week', name: 'On-Target Week', desc: 'Within target 7 days in a row.', category: 'Nutrition', points: 40,
    check: ctx => ctx.onTargetStreak >= 7, progress: ctx => ({ current: Math.min(ctx.onTargetStreak, 7), target: 7 }) },
  { id: 'on_target_month', name: 'On-Target Month', desc: 'Within target on 30 logged days total.', category: 'Nutrition', points: 100,
    check: ctx => ctx.onTargetDays >= 30, progress: ctx => ({ current: Math.min(ctx.onTargetDays, 30), target: 30 }) },
  { id: 'meal_builder_used', name: 'Chef', desc: 'Save your first meal in the meal builder.', category: 'Nutrition', points: 20,
    check: ctx => ctx.savedMealsCount >= 1 },
  { id: 'food_days_30', name: 'Habit Formed', desc: 'Log food on 30 different days.', category: 'Nutrition', points: 60,
    check: ctx => ctx.totalFoodDaysLogged >= 30, progress: ctx => ({ current: Math.min(ctx.totalFoodDaysLogged, 30), target: 30 }) },
  { id: 'big_day_log', name: 'Thorough', desc: 'Log 10+ separate food items in a single day.', category: 'Nutrition', points: 15,
    check: ctx => ctx.maxItemsInADay >= 10 },

  // ---- Weight & goals ----
  { id: 'first_goal_set', name: 'Goal Setter', desc: 'Set your first weight goal.', category: 'Goals', points: 10,
    check: ctx => ctx.hasGoal },
  { id: 'weight_streak_7', name: 'Weigh-In Week', desc: 'Log your weight 7 days in a row.', category: 'Goals', points: 25,
    check: ctx => ctx.weightStreak >= 7, progress: ctx => ({ current: Math.min(ctx.weightStreak, 7), target: 7 }) },
  { id: 'weight_log_30', name: 'Trend Tracker', desc: 'Log your weight 30 times total.', category: 'Goals', points: 50,
    check: ctx => ctx.weightLogCount >= 30, progress: ctx => ({ current: Math.min(ctx.weightLogCount, 30), target: 30 }) },
  { id: 'goal_reached', name: 'Goal Reached', desc: 'Reach your target weight.', category: 'Goals', points: 150,
    check: ctx => ctx.goalReached },

  // ---- Profile & body fat ----
  { id: 'profile_complete', name: 'All Set Up', desc: 'Fill in your full profile (age, height, weight).', category: 'Profile', points: 10,
    check: ctx => ctx.profileComplete },
  { id: 'body_fat_calculated', name: 'Know Your Numbers', desc: 'Calculate your body fat percentage.', category: 'Profile', points: 15,
    check: ctx => ctx.bodyFatCalculated },

  // ---- Pet & misc ----
  { id: 'adopt_pet', name: 'New Friend', desc: 'Choose your pet companion.', category: 'Pet', points: 10,
    check: ctx => ctx.hasPet },
  { id: 'first_purchase', name: 'Shopper', desc: 'Buy your first item from the pet shop.', category: 'Pet', points: 10,
    check: ctx => ctx.ownedItemsCount >= 1 },
  { id: 'fully_dressed', name: 'Fully Dressed', desc: 'Equip an item in every slot at once.', category: 'Pet', points: 40,
    check: ctx => ctx.slotsEquipped >= 5, progress: ctx => ({ current: ctx.slotsEquipped, target: 5 }) },
  { id: 'points_100', name: 'Saver', desc: 'Earn 100 total pet points.', category: 'Pet', points: 10,
    check: ctx => ctx.totalPointsEarned >= 100, progress: ctx => ({ current: Math.min(ctx.totalPointsEarned, 100), target: 100 }) },
  { id: 'points_500', name: 'Big Saver', desc: 'Earn 500 total pet points.', category: 'Pet', points: 30,
    check: ctx => ctx.totalPointsEarned >= 500, progress: ctx => ({ current: Math.min(ctx.totalPointsEarned, 500), target: 500 }) },
  { id: 'points_1000', name: 'Point Millionaire (almost)', desc: 'Earn 1,000 total pet points.', category: 'Pet', points: 75,
    check: ctx => ctx.totalPointsEarned >= 1000, progress: ctx => ({ current: Math.min(ctx.totalPointsEarned, 1000), target: 1000 }) },
];
