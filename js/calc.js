/* ============================================================
   CALCULATIONS
   ============================================================ */

// --- Unit conversions ---
const kgToLb = kg => kg * 2.20462262185;
const lbToKg = lb => lb / 2.20462262185;
const cmToIn = cm => cm / 2.54;
const inToCm = inch => inch * 2.54;

// --- BMR: Mifflin-St Jeor equation ---
function calcBMR({ sex, age, heightCm, weightKg }) {
  if (!age || !heightCm || !weightKg) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

// --- Exercise calorie burn ---
// Standard formula: kcal = MET * 3.5 * weightKg / 200 * minutes
function metCalories(met, weightKg, minutes) {
  if (!met || !weightKg || !minutes) return 0;
  return (met * 3.5 * weightKg / 200) * minutes;
}

// Estimate an effective duration for strength sets (time under tension + rest)
// ~ each rep takes ~3.5s of work, plus a portion of rest credited at low intensity.
function estimateStrengthMinutes(sets, reps) {
  if (!sets || !reps) return 0;
  const workSeconds = sets * reps * 3.5;
  const restSeconds = sets * 60 * 0.4; // count 40% of a ~60s rest as low-level active time
  return (workSeconds + restSeconds) / 60;
}

// Compute calories for a single logged exercise entry.
// entry: { exerciseId, sets, reps, weightKg, durationMin, distanceKm }
function calcExerciseCalories(entry, bodyWeightKg) {
  const ex = EXERCISE_LIBRARY.find(e => e.id === entry.exerciseId) || entry.custom;
  if (!ex || !bodyWeightKg) return 0;
  let minutes = 0;
  if (ex.inputMode === 'duration') {
    minutes = Number(entry.durationMin) || 0;
  } else if (ex.inputMode === 'setsRepsWeight' || ex.inputMode === 'setsReps') {
    minutes = estimateStrengthMinutes(Number(entry.sets), Number(entry.reps));
    // small intensity bump if lifting heavy relative to bodyweight
    if (ex.inputMode === 'setsRepsWeight' && entry.weightKg) {
      const ratio = Number(entry.weightKg) / bodyWeightKg;
      if (ratio > 1) minutes *= 1.15;
    }
  } else if (ex.inputMode === 'distance') {
    minutes = Number(entry.durationMin) || 0;
  }
  return metCalories(ex.met, bodyWeightKg, minutes);
}

// Calories burned from daily step count (rough: 0.04 kcal per step per kg body weight / 70kg baseline)
function calcStepCalories(steps, weightKg) {
  if (!steps || !weightKg) return 0;
  // ~0.57 kcal per 1000 steps per kg bodyweight (approximation, ~30 kcal/1000 steps @70kg)
  return steps * 0.00057 * weightKg;
}

// --- Auto-detect activity level from planner data ---
// Uses: number of workout days/week, avg session length, and steps/day.
function autoDetectActivityLevel({ workoutDaysPerWeek, avgSessionMinutes, stepsPerDay }) {
  let score = 0;
  if (stepsPerDay >= 12000) score += 2;
  else if (stepsPerDay >= 10000) score += 1.5;
  else if (stepsPerDay >= 7000) score += 1;
  else if (stepsPerDay >= 5000) score += 0.5;

  if (workoutDaysPerWeek >= 6) score += 2;
  else if (workoutDaysPerWeek >= 4) score += 1.5;
  else if (workoutDaysPerWeek >= 2) score += 1;
  else if (workoutDaysPerWeek >= 1) score += 0.5;

  if (avgSessionMinutes >= 75) score += 0.5;

  if (score >= 3.5) return ACTIVITY_LEVELS[4]; // very active
  if (score >= 2.5) return ACTIVITY_LEVELS[3]; // active
  if (score >= 1.3) return ACTIVITY_LEVELS[2]; // moderate
  if (score >= 0.4) return ACTIVITY_LEVELS[1]; // light
  return ACTIVITY_LEVELS[0]; // sedentary
}

function calcTDEE(bmr, activityMultiplier) {
  if (!bmr) return null;
  return bmr * activityMultiplier;
}

// --- Goal feasibility ---
// 1 lb of fat ~ 3500 kcal. Returns projected rate + a feasibility verdict (no fear-mongering, just a flag).
function evaluateGoal({ startWeightKg, targetWeightKg, startDate, targetDate, tdee }) {
  if (!startWeightKg || !targetWeightKg || !startDate || !targetDate) return null;
  const deltaKg = targetWeightKg - startWeightKg; // negative = loss
  const days = (new Date(targetDate) - new Date(startDate)) / 86400000;
  if (days <= 0) return { error: 'Target date must be after start date.' };

  const weeks = days / 7;
  const deltaLb = kgToLb(deltaKg);
  const ratePerWeekLb = deltaLb / weeks;
  const dailyDeficitNeeded = (Math.abs(deltaLb) * 3500) / days; // kcal/day required
  const suggestedIntake = tdee ? tdee - (deltaLb < 0 ? dailyDeficitNeeded : -dailyDeficitNeeded) : null;

  // Feasibility bands based on widely-cited safe rate of change (~0.5-1% bodyweight/week, capped ~2lb/week loss, ~0.5-1lb/week gain)
  const absRate = Math.abs(ratePerWeekLb);
  let feasibility = 'reasonable';
  if (deltaLb < 0) {
    if (absRate > 2.5) feasibility = 'unlikely';
    else if (absRate > 1.5) feasibility = 'ambitious';
  } else if (deltaLb > 0) {
    if (absRate > 1.5) feasibility = 'unlikely';
    else if (absRate > 0.75) feasibility = 'ambitious';
  }

  return {
    deltaLb, ratePerWeekLb, dailyDeficitNeeded, suggestedIntake, feasibility, weeks, days,
  };
}

// Progress percentage between start and target
function goalProgressPct(startWeightKg, currentWeightKg, targetWeightKg) {
  if (startWeightKg == null || currentWeightKg == null || targetWeightKg == null) return 0;
  const total = targetWeightKg - startWeightKg;
  if (total === 0) return 100;
  const done = currentWeightKg - startWeightKg;
  return Math.max(0, Math.min(100, (done / total) * 100));
}
